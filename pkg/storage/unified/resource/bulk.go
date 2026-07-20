package resource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/metadata"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const grpcMetaKeyCollection = "x-gf-batch-collection"
const grpcMetaKeySkipValidation = "x-gf-batch-skip-validation"

var defaultBulkBatchOptions = BulkBatchOptions{MaxItems: 1000, MaxBytes: 2 * 1024 * 1024, MaxIdle: 5 * time.Millisecond}

// BulkBatchOptions controls how incoming bulk requests are grouped before they are processed.
type BulkBatchOptions struct {
	MaxItems int
	MaxBytes int
	MaxIdle  time.Duration
}

// Logged in trace.
var metadataKeys = []string{
	grpcMetaKeyCollection,
	grpcMetaKeySkipValidation,
}

func grpcMetaValueIsTrue(vals []string) bool {
	return len(vals) == 1 && vals[0] == "true"
}

type BulkRequestIterator interface {
	// Next advances the iterator to the next element if one exists.
	Next() bool

	// Request returns the current element. Only valid after Next() returns true.
	Request() *resourcepb.BulkRequest

	// RollbackRequested returns true if there was an error advancing the iterator. Checked after Next() returns true.
	RollbackRequested() bool
}

type BulkRequestBatchIterator interface {
	// NextBatch advances the iterator to the next batch if one exists.
	NextBatch() bool

	// Batch returns the current batch. Only valid after NextBatch() returns true.
	Batch() []*resourcepb.BulkRequest

	// RollbackRequested returns true if there was an error advancing the iterator. Checked after NextBatch() returns true.
	RollbackRequested() bool
}

type BulkProcessingBackend interface {
	ProcessBulk(ctx context.Context, setting BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse
}

type BulkResourceWriter interface {
	io.Closer

	Write(ctx context.Context, key *resourcepb.ResourceKey, value []byte) error

	// Called when finished writing
	CloseWithResults() (*resourcepb.BulkResponse, error)
}

type BulkSettings struct {
	// All requests will be within this namespace/group/resource
	Collection []*resourcepb.ResourceKey

	// The byte[] payload and folder has already been validated - no need to decode and verify
	SkipValidation bool
}

func (x *BulkSettings) ToMD() metadata.MD {
	md := make(metadata.MD)
	if len(x.Collection) > 0 {
		for _, v := range x.Collection {
			md[grpcMetaKeyCollection] = append(md[grpcMetaKeyCollection], SearchID(v))
		}
	}
	if x.SkipValidation {
		md[grpcMetaKeySkipValidation] = []string{"true"}
	}
	return md
}

func NewBulkSettings(md metadata.MD) (BulkSettings, error) {
	settings := BulkSettings{}
	for k, v := range md {
		switch k {
		case grpcMetaKeyCollection:
			for _, c := range v {
				key := &resourcepb.ResourceKey{}
				err := ReadSearchID(key, c)
				if err != nil {
					return settings, fmt.Errorf("error reading collection metadata: %s / %w", c, err)
				}
				settings.Collection = append(settings.Collection, key)
			}
		case grpcMetaKeySkipValidation:
			settings.SkipValidation = grpcMetaValueIsTrue(v)
		}
	}
	return settings, nil
}

// DefaultBulkBatchOptions returns the default BulkProcess batching thresholds.
func DefaultBulkBatchOptions() BulkBatchOptions {
	return defaultBulkBatchOptions
}

// BulkWrite implements ResourceServer.
// All requests must be to the same NAMESPACE/GROUP/RESOURCE
func (s *server) BulkProcess(stream resourcepb.BulkStore_BulkProcessServer) error {
	ctx := stream.Context()
	ctx, span := tracer.Start(ctx, "resource.server.BulkProcess")
	defer span.End()

	if !s.trackWrite() {
		return errStopping
	}
	defer s.inflight.Done()

	sendAndClose := func(rsp *resourcepb.BulkResponse) error {
		span.AddEvent("sendAndClose", trace.WithAttributes(attribute.String("msg", rsp.String())))
		return stream.SendAndClose(rsp)
	}

	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return sendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			},
		})
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return sendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "unable to read metadata gRPC request",
				Code:    http.StatusPreconditionFailed,
			},
		})
	}

	// Add relevant metadata into span.
	for _, k := range metadataKeys {
		meta := md.Get(k)
		if len(meta) > 0 {
			span.SetAttributes(attribute.StringSlice(k, meta))
		}
	}

	runner := &batchRunner{
		checker:   make(map[string]authlib.ItemChecker), // Can create
		stream:    stream,
		span:      span,
		batchOpts: s.bulkBatchOptions,
		stopCh:    make(chan struct{}),
	}
	settings, err := NewBulkSettings(md)
	if err != nil {
		return sendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "error reading settings",
				Reason:  err.Error(),
				Code:    http.StatusPreconditionFailed,
			},
		})
	}

	if len(settings.Collection) < 1 {
		return sendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "Missing target collection(s) in request header",
				Code:    http.StatusBadRequest,
			},
		})
	}

	// Verify all collection request keys are valid
	for _, k := range settings.Collection {
		if r := verifyRequestKeyCollection(k); r != nil {
			return sendAndClose(&resourcepb.BulkResponse{
				Error: &resourcepb.ErrorResult{
					Message: fmt.Sprintf("invalid request key: %s", r.Message),
					Code:    http.StatusBadRequest,
				},
			})
		}
	}

	for _, k := range settings.Collection {
		// Can we delete the whole collection
		rsp, err := s.access.Check(ctx, user, authlib.CheckRequest{
			Namespace: k.Namespace,
			Group:     k.Group,
			Resource:  k.Resource,
			Verb:      utils.VerbDeleteCollection,
		}, "")
		if err != nil || !rsp.Allowed {
			return sendAndClose(&resourcepb.BulkResponse{
				Error: &resourcepb.ErrorResult{
					Message: fmt.Sprintf("Requester must be able to: %s", utils.VerbDeleteCollection),
					Code:    http.StatusForbidden,
				},
			})
		}

		// This will be called for each request -- with the folder ID
		//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
		runner.checker[NSGR(k)], _, err = s.access.Compile(ctx, user, authlib.ListRequest{
			Namespace: k.Namespace,
			Group:     k.Group,
			Resource:  k.Resource,
			Verb:      utils.VerbCreate,
		})
		if err != nil {
			return sendAndClose(&resourcepb.BulkResponse{
				Error: &resourcepb.ErrorResult{
					Message: "Unable to check `create` permission",
					Code:    http.StatusForbidden,
				},
			})
		}
	}

	backend, ok := s.backend.(BulkProcessingBackend)
	if !ok {
		return sendAndClose(&resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Message: "The server backend does not support batch processing",
				Code:    http.StatusNotImplemented,
			},
		})
	}

	// BulkProcess requests
	defer runner.stop()
	rsp := backend.ProcessBulk(ctx, settings, runner)
	if rsp == nil {
		rsp = &resourcepb.BulkResponse{
			Error: &resourcepb.ErrorResult{
				Code:    http.StatusInternalServerError,
				Message: "Nothing returned from process batch",
			},
		}
	}
	if runner.err != nil {
		rsp.Error = AsErrorResult(runner.err)
	}

	return sendAndClose(rsp)
}

var (
	_ BulkRequestIterator      = (*batchRunner)(nil)
	_ BulkRequestBatchIterator = (*batchRunner)(nil)
)

type batchRunner struct {
	stream    resourcepb.BulkStore_BulkProcessServer
	rollback  bool
	request   *resourcepb.BulkRequest
	batch     []*resourcepb.BulkRequest
	batchIdx  int
	err       error
	checker   map[string]authlib.ItemChecker
	span      trace.Span
	batchOpts BulkBatchOptions

	recvOnce sync.Once
	recvCh   chan batchStreamResult
	pending  *batchStreamResult
	stopCh   chan struct{}
	stopOnce sync.Once
}

type batchStreamResult struct {
	request  *resourcepb.BulkRequest
	err      error
	rollback bool
	eof      bool
}

// Next implements BulkRequestIterator.
func (b *batchRunner) Next() bool {
	if b.rollback {
		return true
	}

	if b.batchIdx < len(b.batch) {
		b.request = b.batch[b.batchIdx]
		b.batchIdx++
		return true
	}

	if !b.NextBatch() {
		return false
	}
	if b.rollback {
		b.request = nil
		return true
	}
	if len(b.batch) == 0 {
		b.err = fmt.Errorf("missing request batch")
		b.rollback = true
		return true
	}

	b.request = b.batch[0]
	b.batchIdx = 1
	return true
}

func (b *batchRunner) NextBatch() bool {
	if b.rollback {
		return true
	}

	b.batch = b.batch[:0]
	b.batchIdx = 0
	opts := b.batchOpts
	payloadBytes := 0

	appendRequest := func(req *resourcepb.BulkRequest) bool {
		b.batch = append(b.batch, req)
		payloadBytes += len(req.Value)

		if opts.MaxItems > 0 && len(b.batch) >= opts.MaxItems {
			return true
		}
		if opts.MaxBytes > 0 && payloadBytes >= opts.MaxBytes {
			return true
		}
		return false
	}

	result := b.readNextResult()
	switch {
	case result.eof:
		return false
	case result.err != nil:
		b.err = result.err
		b.rollback = result.rollback
		return true
	case result.request == nil:
		b.err = fmt.Errorf("missing request")
		b.rollback = true
		return true
	default:
		if appendRequest(result.request) {
			return true
		}
	}

	var (
		timer  *time.Timer
		timerC <-chan time.Time
	)
	if opts.MaxIdle > 0 {
		timer = time.NewTimer(opts.MaxIdle)
		defer stopAndDrainTimer(timer)
		timerC = timer.C
	}

	for {
		select {
		case result, ok := <-b.recvChannel():
			if !ok {
				return true
			}
			switch {
			case result.eof || result.err != nil:
				b.pending = &result
				return true
			case result.request == nil:
				b.pending = &batchStreamResult{
					err:      fmt.Errorf("missing request"),
					rollback: true,
				}
				return true
			default:
				if appendRequest(result.request) {
					return true
				}
				if timer != nil {
					resetTimer(timer, opts.MaxIdle)
				}
			}
		case <-timerC:
			return true
		}
	}
}

func (b *batchRunner) Batch() []*resourcepb.BulkRequest {
	if b.rollback {
		return nil
	}
	return b.batch
}

// Request implements BulkRequestIterator.
func (b *batchRunner) Request() *resourcepb.BulkRequest {
	if b.rollback {
		return nil
	}
	return b.request
}

// RollbackRequested implements BulkRequestIterator.
func (b *batchRunner) RollbackRequested() bool {
	if b.rollback {
		b.rollback = false // break iterator
		return true
	}
	return false
}

func (b *batchRunner) recvChannel() <-chan batchStreamResult {
	b.recvOnce.Do(func() {
		b.recvCh = make(chan batchStreamResult, 1)
		go b.recvLoop()
	})
	return b.recvCh
}

func (b *batchRunner) readNextResult() batchStreamResult {
	if b.pending != nil {
		result := *b.pending
		b.pending = nil
		return result
	}

	result, ok := <-b.recvChannel()
	if !ok {
		return batchStreamResult{eof: true}
	}
	return result
}

func (b *batchRunner) recvLoop() {
	defer close(b.recvCh)

	for {
		req, err := b.stream.Recv()
		if errors.Is(err, io.EOF) {
			if !b.sendResult(batchStreamResult{eof: true}) {
				return
			}
			return
		}
		if err != nil {
			b.span.AddEvent("next", trace.WithAttributes(attribute.String("error", err.Error())))
			if !b.sendResult(batchStreamResult{err: err, rollback: true}) {
				return
			}
			return
		}
		if req == nil {
			if !b.sendResult(batchStreamResult{
				err:      fmt.Errorf("missing request"),
				rollback: true,
			}) {
				return
			}
			return
		}

		key := req.Key
		k := NSGR(key)
		checker, ok := b.checker[k]
		if !ok {
			err = fmt.Errorf("missing access control for: %s", k)
		} else if !checker(key.Name, req.Folder) {
			err = fmt.Errorf("not allowed to create resource")
		}

		attrs := []attribute.KeyValue{
			attribute.String("key", nsgrWithName(key)),
		}
		if err != nil {
			attrs = append(attrs, attribute.String("error", err.Error()))
			b.span.AddEvent("next", trace.WithAttributes(attrs...))
			if !b.sendResult(batchStreamResult{err: err, rollback: true}) {
				return
			}
			return
		}

		b.span.AddEvent("next", trace.WithAttributes(attrs...))
		if !b.sendResult(batchStreamResult{request: req}) {
			return
		}
	}
}

func (b *batchRunner) sendResult(result batchStreamResult) bool {
	select {
	case <-b.stopCh:
		return false
	case b.recvCh <- result:
		return true
	}
}

func (b *batchRunner) stop() {
	b.stopOnce.Do(func() {
		close(b.stopCh)
	})
}

func resetTimer(timer *time.Timer, d time.Duration) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(d)
}

func stopAndDrainTimer(timer *time.Timer) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
}

type bulkRV struct {
	max    int64
	lastRV int64
}

// Used when executing a bulk import so that we can generate snowflake RVs in the past.
// The 30s offset ensures bulk-imported RVs don't clash with concurrent writes
// that use the RV manager (both generate node=0 snowflakes in compatibility mode).
func newBulkRV() *bulkRV {
	t := snowflakeFromTime(time.Now().Add(-30 * time.Second))
	return &bulkRV{
		max: t,
	}
}

func (x *bulkRV) next(obj metav1.Object) int64 {
	ts := snowflakeFromTime(obj.GetCreationTimestamp().Time)
	anno := obj.GetAnnotations()
	if anno != nil {
		v := anno[utils.AnnoKeyUpdatedTimestamp]
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			ts = snowflakeFromTime(t)
		}
	}
	if ts > x.max || ts < 1e18 {
		ts = x.max
	}

	// Use the object's timestamp as the base, but never go below the last
	// emitted RV so that every value is unique regardless of iterator order.
	base := ts
	if base < x.lastRV {
		base = x.lastRV
	}

	// Increment, keeping the sub-millisecond portion (low 22 bits) under 1000
	// so that the snowflake ↔ microRV roundtrip (SnowflakeFromRV / RVFromSnowflake)
	// is lossless.
	// TODO: remove when backwards compatibility is no longer needed
	shift := snowflake.NodeBits + snowflake.StepBits
	subMs := base & ((1 << shift) - 1)
	if subMs >= 999 {
		base = ((base >> shift) + 1) << shift
	} else {
		base++
	}

	x.lastRV = base
	return base
}

type BulkLock struct {
	running map[string]bool
	mu      sync.Mutex
}

func NewBulkLock() *BulkLock {
	return &BulkLock{
		running: make(map[string]bool),
	}
}

func (x *BulkLock) Start(keys []*resourcepb.ResourceKey) error {
	x.mu.Lock()
	defer x.mu.Unlock()

	// First verify that it is not already running
	ids := make([]string, len(keys))
	for i, k := range keys {
		id := NSGR(k)
		if x.running[id] {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Code:    http.StatusPreconditionFailed,
				Message: "bulk export is already running",
			}}
		}
		ids[i] = id
	}

	// Then add the keys to the lock
	for _, k := range ids {
		x.running[k] = true
	}
	return nil
}

func (x *BulkLock) Finish(keys []*resourcepb.ResourceKey) {
	x.mu.Lock()
	defer x.mu.Unlock()
	for _, k := range keys {
		delete(x.running, NSGR(k))
	}
}

func (x *BulkLock) Active() bool {
	x.mu.Lock()
	defer x.mu.Unlock()
	return len(x.running) > 0
}
