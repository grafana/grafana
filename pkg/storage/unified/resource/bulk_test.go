package resource

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"iter"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestResourceServerOptionsBulkBatchOptions(t *testing.T) {
	custom := BulkBatchOptions{
		MaxItems: 42,
		MaxBytes: 3 << 20,
		MaxIdle:  15 * time.Millisecond,
	}

	cases := []struct {
		name string
		opts ResourceServerOptions
		want BulkBatchOptions
	}{
		{
			name: "default",
			opts: ResourceServerOptions{},
			want: DefaultBulkBatchOptions(),
		},
		{
			name: "custom",
			opts: ResourceServerOptions{BulkBatchOptions: &custom},
			want: custom,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, tc.opts.bulkBatchOptions())
		})
	}
}

func TestProcessBulkWithPreflightRejectsBeforeBackend(t *testing.T) {
	want := errors.New("invalid spool")
	iter := &failingPreflightIterator{err: want}
	backend := &preflightTestBackend{}

	rsp, err := processBulkWithPreflight(t.Context(), backend, BulkSettings{}, iter)

	require.False(t, backend.called)
	require.Nil(t, rsp)
	require.ErrorIs(t, err, want)
}

func TestSpooledBulkRequestsPreflightRejectsCorruptRecords(t *testing.T) {
	for _, tc := range []struct {
		name    string
		content []byte
		message string
	}{
		{name: "truncated record", content: []byte{3}, message: "truncated"},
		{name: "invalid record", content: []byte{1, 0xff}, message: "unmarshal"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			file, err := os.CreateTemp(t.TempDir(), "bulk-spool-*.tmp")
			require.NoError(t, err)
			_, err = file.Write(tc.content)
			require.NoError(t, err)
			spool := &spooledBulkRequests{file: file, reader: bufio.NewReader(file)}
			t.Cleanup(spool.Close)

			err = spool.Preflight()
			require.ErrorContains(t, err, tc.message)
		})
	}
}

func TestBulkSpoolBudgetBoundsAggregateUsage(t *testing.T) {
	budget := newBulkSpoolBudget(10)

	require.NoError(t, budget.reserve(6))
	require.EqualValues(t, 6, budget.used())
	require.Error(t, budget.reserve(5))
	require.EqualValues(t, 6, budget.used())

	budget.release(6)
	require.NoError(t, budget.reserve(5))
	require.EqualValues(t, 5, budget.used())
}

func TestSpoolBulkRequestsReleasesBudgetAfterQuotaError(t *testing.T) {
	budget := newBulkSpoolBudget(1)
	iter := newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{newTestBulkRequest("item")})

	spool, err := spoolBulkRequests(t.Context(), iter, DefaultBulkBatchOptions(), budget)

	require.Nil(t, spool)
	require.Error(t, err)
	require.EqualValues(t, 0, budget.used())
	require.EqualValues(t, 413, AsErrorResult(err).Code)
}

func TestSpoolBulkRequestsCancellation(t *testing.T) {
	for _, cancelBeforeStart := range []bool{true, false} {
		name := "after first batch"
		if cancelBeforeStart {
			name = "before first batch"
		}
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			budget := newBulkSpoolBudget(1 << 20)
			source := newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{newTestBulkRequest("item")})
			iter := &checkingBulkIterator{
				batchOnlyBulkIterator: source,
				beforeNext: func() {
					if source.idx == 0 {
						require.Positive(t, budget.used())
						cancel()
					}
				},
			}
			if cancelBeforeStart {
				cancel()
			}

			spool, err := spoolBulkRequests(ctx, iter, DefaultBulkBatchOptions(), budget)

			require.Nil(t, spool)
			require.ErrorIs(t, err, context.Canceled)
			require.Zero(t, budget.used())
			if cancelBeforeStart {
				require.Equal(t, -1, source.idx)
			}
		})
	}
}

func TestSpooledBulkRequestsNextBatchCancellation(t *testing.T) {
	budget := newBulkSpoolBudget(1 << 20)
	iter := newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
	})
	spool, err := spoolBulkRequests(t.Context(), iter, BulkBatchOptions{MaxItems: 1}, budget)
	require.NoError(t, err)
	t.Cleanup(spool.Close)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	require.False(t, spool.NextBatch(ctx))
	require.False(t, spool.RollbackRequested())
	require.True(t, spool.NextBatch(t.Context()))
	require.Equal(t, "item-1", spool.Batch()[0].Key.Name)
	require.False(t, spool.NextBatch(ctx))
	require.True(t, spool.NextBatch(t.Context()))
	require.Equal(t, "item-2", spool.Batch()[0].Key.Name)
	require.False(t, spool.NextBatch(t.Context()))
}

func TestBatchRunnerNextBatchHonorsMaxItemsAndEOF(t *testing.T) {
	opts := testBulkBatchOptions(2, 1<<20, 0)
	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
		newTestBulkRequest("item-3"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{requests: reqs}, reqs[0].Key, opts)

	require.True(t, runner.NextBatch(t.Context()))
	require.Len(t, runner.Batch(), 2)
	require.Equal(t, "item-1", runner.Batch()[0].Key.Name)
	require.Equal(t, "item-2", runner.Batch()[1].Key.Name)
	require.False(t, runner.RollbackRequested())

	require.True(t, runner.NextBatch(t.Context()))
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-3", runner.Batch()[0].Key.Name)
	require.False(t, runner.RollbackRequested())

	require.False(t, runner.NextBatch(t.Context()))
}

func TestBatchRunnerNextBatchHonorsIdleFlush(t *testing.T) {
	opts := testBulkBatchOptions(100, 1<<20, 5*time.Millisecond)
	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{
		requests: reqs,
		delays:   []time.Duration{0, 20 * time.Millisecond},
	}, reqs[0].Key, opts)

	require.True(t, runner.NextBatch(t.Context()))
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-1", runner.Batch()[0].Key.Name)

	require.True(t, runner.NextBatch(t.Context()))
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-2", runner.Batch()[0].Key.Name)

	require.False(t, runner.NextBatch(t.Context()))
}

func TestBatchRunnerNextPreservesSingleItemIteration(t *testing.T) {
	opts := testBulkBatchOptions(2, 1<<20, 0)
	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
		newTestBulkRequest("item-3"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{requests: reqs}, reqs[0].Key, opts)

	got := make([]string, 0, len(reqs))
	for runner.Next() {
		require.False(t, runner.RollbackRequested())
		got = append(got, runner.Request().Key.Name)
	}

	require.Equal(t, []string{"item-1", "item-2", "item-3"}, got)
}

func TestBatchRunnerNextBatchRollbackOnAccessError(t *testing.T) {
	opts := testBulkBatchOptions(10, 1<<20, 0)
	req := newTestBulkRequest("item-1")
	runner := &batchRunner{
		stream:    &testBulkProcessServer{requests: []*resourcepb.BulkRequest{req}},
		checker:   map[string]authlib.ItemChecker{},
		span:      trace.SpanFromContext(context.Background()),
		batchOpts: opts,
		stopCh:    make(chan struct{}),
	}

	require.True(t, runner.NextBatch(t.Context()))
	require.Empty(t, runner.Batch())
	require.True(t, runner.RollbackRequested())
	require.ErrorContains(t, runner.err, "missing access control")
}

func TestBatchRunnerStopUnblocksBlockedSend(t *testing.T) {
	runner := &batchRunner{
		recvCh: make(chan batchStreamResult, 1),
		stopCh: make(chan struct{}),
	}
	runner.recvCh <- batchStreamResult{request: newTestBulkRequest("item-1")}

	sendDone := make(chan bool, 1)
	go func() {
		sendDone <- runner.sendResult(batchStreamResult{request: newTestBulkRequest("item-2")})
	}()

	select {
	case <-sendDone:
		t.Fatal("sendResult should block until the runner is stopped")
	case <-time.After(20 * time.Millisecond):
	}

	runner.stop()

	select {
	case sent := <-sendDone:
		require.False(t, sent)
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for sendResult to unblock")
	}
}

func TestBulkProcessStopsRunnerOnPanic(t *testing.T) {
	backend := &panicBulkBackend{}
	srv := &server{
		backend:          backend,
		access:           authlib.FixedAccessClient(true),
		bulkBatchOptions: DefaultBulkBatchOptions(),
	}

	req := newTestBulkRequest("item-1")
	settings := BulkSettings{
		Collection: []*resourcepb.ResourceKey{
			{
				Namespace: req.Key.Namespace,
				Group:     req.Key.Group,
				Resource:  req.Key.Resource,
			},
		},
	}

	ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{
		Type:           authlib.TypeUser,
		Login:          "testuser",
		UserID:         1,
		UserUID:        "u1",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	})
	ctx = metadata.NewIncomingContext(ctx, settings.ToMD())

	stream := &testBulkProcessServer{ctx: ctx}

	require.PanicsWithValue(t, errPanicBulkProcess, func() {
		_ = srv.BulkProcess(stream)
	})

	select {
	case sent := <-backend.sendDone:
		require.False(t, sent)
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for blocked send to stop")
	}
}

// Early rejections are covered by the blob validation tests; these cover a
// backend's call-level failure, which must become the stream status instead of
// a response carrying partial results.
func TestBulkProcessReturnsBackendFailureAsStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "bulk import failed"}
	conflict := apierrors.NewConflict(schema.GroupResource{Group: "g", Resource: "r"}, "n", errors.New("changed"))
	partial := &resourcepb.BulkResponse{Processed: 1}

	for _, tc := range []struct {
		name  string
		err   error
		check func(t *testing.T, err error)
	}{
		{
			name: "status with details passes through",
			err:  GRPCStatusError(failure),
			check: func(t *testing.T, err error) {
				requireRPCError(t, err, failure)
			},
		},
		{
			name: "API status keeps code and details",
			err:  fmt.Errorf("import: %w", conflict),
			check: func(t *testing.T, err error) {
				res := rpcErrorResult(t, err)
				require.Equal(t, codes.Aborted, status.Code(err))
				require.EqualValues(t, http.StatusConflict, res.Code)
				require.Equal(t, "n", res.Details.GetName())
			},
		},
		{
			name: "plain error becomes internal",
			err:  errors.New("storage failed"),
			check: func(t *testing.T, err error) {
				requireRPCError(t, err, &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "storage failed"})
			},
		},
		{
			name: "cancellation stays canceled",
			err:  context.Canceled,
			check: func(t *testing.T, err error) {
				require.Equal(t, codes.Canceled, status.Code(err))
			},
		},
		{
			name: "storage failure joined with cancellation stays internal",
			err:  errors.Join(errors.New("storage failed"), status.Error(codes.Canceled, "canceled")),
			check: func(t *testing.T, err error) {
				require.Equal(t, codes.Internal, status.Code(err))
				require.Contains(t, rpcErrorResult(t, err).Message, "storage failed")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			stream := newBulkProcessTestStream(t, nil)
			err := newBulkProcessTestServer(&failingBulkBackend{rsp: partial, err: tc.err}).BulkProcess(stream)
			tc.check(t, err)
			require.Nil(t, stream.response)
		})
	}
}

func TestBulkProcessNilBackendResponse(t *testing.T) {
	stream := newBulkProcessTestStream(t, nil)
	err := newBulkProcessTestServer(&failingBulkBackend{}).BulkProcess(stream)
	requireRPCError(t, err, &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "Nothing returned from process batch"})
	require.Nil(t, stream.response)
}

func TestBulkProcessSendsRejectedItems(t *testing.T) {
	rejected := []*resourcepb.BulkResponse_Rejected{{
		Key:    newTestBulkRequest("item").Key,
		Action: resourcepb.BulkRequest_ADDED,
		Error:  "unable to unmarshal json",
	}}
	stream := newBulkProcessTestStream(t, nil)
	err := newBulkProcessTestServer(&failingBulkBackend{rsp: &resourcepb.BulkResponse{Processed: 1, Rejected: rejected}}).BulkProcess(stream)
	require.NoError(t, err)
	require.Len(t, stream.response.Rejected, 1)
	require.True(t, proto.Equal(rejected[0], stream.response.Rejected[0]))
}

// The stream error explains why the backend stopped early, so it is reported
// instead of the backend's own failure.
func TestBulkProcessStreamErrorTakesPrecedence(t *testing.T) {
	streamErr := status.Error(codes.Unavailable, "client went away")
	stream := newBulkProcessTestStream(t, []*resourcepb.BulkRequest{newTestBulkRequest("item")})
	stream.terminalErr = streamErr
	backend := &failingBulkBackend{err: errors.New("backend failed"), consume: true}

	err := newBulkProcessTestServer(backend).BulkProcess(stream)
	require.Same(t, streamErr, err)
	require.Nil(t, stream.response)
}

func TestBulkProcessCloseAndRecvReturnsBackendStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{Code: http.StatusConflict, Message: "import conflict", Reason: "Conflict"}
	srv := newBulkProcessTestServer(&failingBulkBackend{rsp: &resourcepb.BulkResponse{Processed: 1}, err: GRPCStatusError(failure), consume: true})
	key := newTestBulkRequest("item").Key
	settings := BulkSettings{Collection: []*resourcepb.ResourceKey{{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}}}
	ctx := identity.WithServiceIdentityForSingleNamespaceContext(t.Context(), key.Namespace)

	stream, err := NewLocalResourceClient(srv).BulkProcess(metadata.NewOutgoingContext(ctx, settings.ToMD()))
	require.NoError(t, err)
	require.NoError(t, stream.Send(newTestBulkRequest("item")))
	rsp, err := stream.CloseAndRecv()
	require.Nil(t, rsp)
	requireRPCError(t, err, failure)
}

func newBulkProcessTestServer(backend StorageBackend) *server {
	return &server{
		backend:          backend,
		access:           authlib.FixedAccessClient(true),
		bulkBatchOptions: DefaultBulkBatchOptions(),
	}
}

func newBulkProcessTestStream(t *testing.T, requests []*resourcepb.BulkRequest) *bulkBlobValidationStream {
	key := newTestBulkRequest("item").Key
	settings := BulkSettings{Collection: []*resourcepb.ResourceKey{{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}}}
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1"})
	return &bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{
		ctx:      metadata.NewIncomingContext(ctx, settings.ToMD()),
		requests: requests,
	}}
}

func newTestBatchRunner(stream resourcepb.BulkStore_BulkProcessServer, key *resourcepb.ResourceKey, opts BulkBatchOptions) *batchRunner {
	return &batchRunner{
		stream: stream,
		checker: map[string]authlib.ItemChecker{
			NSGR(key): func(string, string) bool { return true },
		},
		span:      trace.SpanFromContext(context.Background()),
		batchOpts: opts,
		stopCh:    make(chan struct{}),
	}
}

func testBulkBatchOptions(maxItems, maxBytes int, maxIdle time.Duration) BulkBatchOptions {
	opts := DefaultBulkBatchOptions()
	opts.MaxItems = maxItems
	opts.MaxBytes = maxBytes
	opts.MaxIdle = maxIdle
	return opts
}

func newTestBulkRequest(name string) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "shorturl.grafana.app",
			Resource:  "shorturls",
			Name:      name,
		},
		Action: resourcepb.BulkRequest_ADDED,
		Value:  []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"` + name + `","namespace":"default"},"spec":{"path":"d/test"}}`),
	}
}

type failingPreflightIterator struct {
	err error
}

func (i *failingPreflightIterator) Preflight() error                 { return i.err }
func (i *failingPreflightIterator) Next() bool                       { return false }
func (i *failingPreflightIterator) Request() *resourcepb.BulkRequest { return nil }
func (i *failingPreflightIterator) RollbackRequested() bool          { return false }

type preflightTestBackend struct {
	called bool
}

func (*preflightTestBackend) RequiresBulkPreflight() {}

func (b *preflightTestBackend) ProcessBulk(context.Context, BulkSettings, BulkRequestIterator) (*resourcepb.BulkResponse, error) {
	b.called = true
	return &resourcepb.BulkResponse{}, nil
}

type failingBulkBackend struct {
	UnimplementedStorageBackend
	rsp *resourcepb.BulkResponse
	err error
	// consume drains the iterator before failing, as a backend does when the
	// stream breaks mid-import.
	consume bool
}

func (b *failingBulkBackend) ProcessBulk(_ context.Context, _ BulkSettings, iter BulkRequestIterator) (*resourcepb.BulkResponse, error) {
	for b.consume && iter.Next() {
		if iter.RollbackRequested() {
			break
		}
	}
	return b.rsp, b.err
}

type testBulkProcessServer struct {
	ctx         context.Context
	requests    []*resourcepb.BulkRequest
	delays      []time.Duration
	terminalErr error
	idx         int
}

func (s *testBulkProcessServer) SendAndClose(*resourcepb.BulkResponse) error {
	return nil
}

func (s *testBulkProcessServer) Recv() (*resourcepb.BulkRequest, error) {
	if s.idx < len(s.requests) {
		if s.idx < len(s.delays) && s.delays[s.idx] > 0 {
			time.Sleep(s.delays[s.idx])
		}
		req := s.requests[s.idx]
		s.idx++
		return req, nil
	}
	if s.terminalErr != nil {
		err := s.terminalErr
		s.terminalErr = nil
		return nil, err
	}
	return nil, io.EOF
}

func (s *testBulkProcessServer) SetHeader(metadata.MD) error {
	return nil
}

func (s *testBulkProcessServer) SendHeader(metadata.MD) error {
	return nil
}

func (s *testBulkProcessServer) SetTrailer(metadata.MD) {}

func (s *testBulkProcessServer) Context() context.Context {
	if s.ctx != nil {
		return s.ctx
	}
	return context.Background()
}

func (s *testBulkProcessServer) SendMsg(any) error {
	return nil
}

func (s *testBulkProcessServer) RecvMsg(any) error {
	return nil
}

const errPanicBulkProcess = "panic from ProcessBulk"

type panicBulkBackend struct {
	UnimplementedStorageBackend
	sendDone chan bool
}

func (b *panicBulkBackend) ProcessBulk(_ context.Context, _ BulkSettings, iter BulkRequestIterator) (*resourcepb.BulkResponse, error) {
	runner, ok := iter.(*batchRunner)
	if !ok {
		panic("expected batchRunner")
	}

	runner.recvCh = make(chan batchStreamResult, 1)
	runner.recvCh <- batchStreamResult{request: newTestBulkRequest("item-1")}
	b.sendDone = make(chan bool, 1)
	go func() {
		b.sendDone <- runner.sendResult(batchStreamResult{request: newTestBulkRequest("item-2")})
	}()

	select {
	case <-b.sendDone:
		panic("sendResult unexpectedly unblocked")
	case <-time.After(20 * time.Millisecond):
	}

	panic(errPanicBulkProcess)
}

func (b *panicBulkBackend) WriteEvent(context.Context, WriteEvent) (int64, error) {
	return 0, nil
}

func (b *panicBulkBackend) ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse {
	return nil
}

func (b *panicBulkBackend) ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (b *panicBulkBackend) ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (b *panicBulkBackend) ListModifiedSince(context.Context, NamespacedResource, int64, *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, nil
}

func (b *panicBulkBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	ch := make(chan *WrittenEvent)
	context.AfterFunc(ctx, func() { close(ch) })
	return ch, nil
}

func (b *panicBulkBackend) GetResourceStats(context.Context, NamespacedResource, int) ([]ResourceStats, error) {
	return nil, nil
}

func (b *panicBulkBackend) GetResourceLastImportTime(context.Context, NamespacedResource) (time.Time, error) {
	panic("not implemented")
}

func TestBulkRV(t *testing.T) {
	now := time.Now()
	object := func(updated time.Time) metav1.Object {
		obj := &metav1.ObjectMeta{CreationTimestamp: metav1.NewTime(updated.Add(-time.Hour))}
		if !updated.IsZero() {
			obj.SetAnnotations(map[string]string{utils.AnnoKeyUpdatedTimestamp: updated.UTC().Format(time.RFC3339)})
		}
		return obj
	}
	rvTime := func(rv int64) time.Time {
		return time.UnixMilli(snowflakeTimestampMillis(rv))
	}

	t.Run("an old deletion after a recently updated object keeps its own age", func(t *testing.T) {
		g := newBulkRV()
		recent := g.next("a", object(now.Add(-time.Minute)))
		deleted := g.next("b", object(now.Add(-90*24*time.Hour)))
		require.Less(t, deleted, recent)
		require.WithinDuration(t, now.Add(-90*24*time.Hour), rvTime(deleted), time.Second)
	})

	t.Run("a deletion takes its deletion time, not its last edit", func(t *testing.T) {
		g := newBulkRV()
		obj := object(now.Add(-2 * 365 * 24 * time.Hour))
		deletedAt := metav1.NewTime(now.Add(-24 * time.Hour))
		obj.SetDeletionTimestamp(&deletedAt)
		require.WithinDuration(t, deletedAt.Time, rvTime(g.next("a", obj)), time.Second)
	})

	t.Run("versions of one object keep increasing when timestamps go back", func(t *testing.T) {
		g := newBulkRV()
		first := g.next("a", object(now.Add(-time.Hour)))
		second := g.next("a", object(now.Add(-2*time.Hour)))
		require.Greater(t, second, first)
	})

	t.Run("RVs stay unique across objects in the same millisecond", func(t *testing.T) {
		g := newBulkRV()
		ts := now.Add(-time.Hour).Truncate(time.Second)
		seen := map[int64]bool{}
		for i := range 2500 {
			rv := g.next(fmt.Sprintf("obj-%d", i), object(ts))
			require.False(t, seen[rv], "duplicate RV %d", rv)
			seen[rv] = true
			require.Less(t, rv&((1<<resourceVersionTimestampShift)-1), int64(1000), "sub-millisecond counter must stay under 1000")
		}
	})

	t.Run("an object whose last version filled a millisecond continues in a later one", func(t *testing.T) {
		g := newBulkRV()
		ts := object(now.Add(-time.Hour).Truncate(time.Second))
		var last int64
		for i := range 999 {
			last = g.next(fmt.Sprintf("filler-%d", i), ts)
		}
		require.Equal(t, int64(999), last&((1<<resourceVersionTimestampShift)-1), "the millisecond is full")
		g.lastRV["obj"] = last
		next := g.next("obj", ts)
		require.Greater(t, next, last)
		require.Equal(t, last>>resourceVersionTimestampShift+1, next>>resourceVersionTimestampShift)
	})

	t.Run("a large cohort with one timestamp stays unique and skips full milliseconds", func(t *testing.T) {
		g := newBulkRV()
		at := now.Add(-time.Hour).Truncate(time.Second)
		seen := map[int64]bool{}
		prev := int64(0)
		for i := range 50_000 {
			rv := g.next(fmt.Sprintf("obj-%d", i), object(at))
			require.False(t, seen[rv], "duplicate RV %d", rv)
			require.Greater(t, rv, prev, "a cohort fills milliseconds in order")
			seen[rv], prev = true, rv
		}
		// The cohort's first millisecond points straight at the one still open, so the
		// next object with this timestamp skips every full millisecond in one step
		start := snowflakeFromTime(at) >> resourceVersionTimestampShift
		require.Equal(t, prev>>resourceVersionTimestampShift, g.nextFree[start])
	})

	t.Run("objects without a usable timestamp get unique RVs below the import start", func(t *testing.T) {
		g := newBulkRV()
		a := g.next("a", &metav1.ObjectMeta{})
		b := g.next("b", &metav1.ObjectMeta{})
		require.NotEqual(t, a, b)
		require.WithinDuration(t, now.Add(-30*time.Second), rvTime(a), 2*time.Second)
	})
}
