package resource

import (
	"bufio"
	"context"
	"errors"
	"io"
	"iter"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/metadata"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

	rsp := processBulkWithPreflight(t.Context(), backend, BulkSettings{}, iter)

	require.False(t, backend.called)
	require.NotNil(t, rsp.Error)
	require.Contains(t, rsp.Error.Message, want.Error())
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

// Early rejections are covered by the blob validation tests; this covers a
// backend's call-level failure, which must become the stream status instead of
// a response carrying partial results.
func TestBulkProcessReturnsBackendFailureAsStatus(t *testing.T) {
	failure := &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "bulk import failed"}
	srv := &server{
		backend:          &failingBulkBackend{rsp: &resourcepb.BulkResponse{Processed: 1, Error: failure}},
		access:           authlib.FixedAccessClient(true),
		bulkBatchOptions: DefaultBulkBatchOptions(),
	}
	key := newTestBulkRequest("item").Key
	settings := BulkSettings{Collection: []*resourcepb.ResourceKey{{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}}}
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1"})
	stream := &bulkBlobValidationStream{testBulkProcessServer: testBulkProcessServer{ctx: metadata.NewIncomingContext(ctx, settings.ToMD())}}

	requireRPCError(t, srv.BulkProcess(stream), failure)
	require.Nil(t, stream.response)
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

func (b *preflightTestBackend) ProcessBulk(context.Context, BulkSettings, BulkRequestIterator) *resourcepb.BulkResponse {
	b.called = true
	return &resourcepb.BulkResponse{}
}

type failingBulkBackend struct {
	UnimplementedStorageBackend
	rsp *resourcepb.BulkResponse
}

func (b *failingBulkBackend) ProcessBulk(context.Context, BulkSettings, BulkRequestIterator) *resourcepb.BulkResponse {
	return b.rsp
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

func (b *panicBulkBackend) ProcessBulk(_ context.Context, _ BulkSettings, iter BulkRequestIterator) *resourcepb.BulkResponse {
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
