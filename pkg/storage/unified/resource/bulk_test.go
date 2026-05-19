package resource

import (
	"context"
	"io"
	"iter"
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

func TestBatchRunnerNextBatchHonorsMaxItemsAndEOF(t *testing.T) {
	opts := testBulkBatchOptions(2, 1<<20, 0)
	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
		newTestBulkRequest("item-3"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{requests: reqs}, reqs[0].Key, opts)

	require.True(t, runner.NextBatch())
	require.Len(t, runner.Batch(), 2)
	require.Equal(t, "item-1", runner.Batch()[0].Key.Name)
	require.Equal(t, "item-2", runner.Batch()[1].Key.Name)
	require.False(t, runner.RollbackRequested())

	require.True(t, runner.NextBatch())
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-3", runner.Batch()[0].Key.Name)
	require.False(t, runner.RollbackRequested())

	require.False(t, runner.NextBatch())
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

	require.True(t, runner.NextBatch())
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-1", runner.Batch()[0].Key.Name)

	require.True(t, runner.NextBatch())
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-2", runner.Batch()[0].Key.Name)

	require.False(t, runner.NextBatch())
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

	require.True(t, runner.NextBatch())
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

func (b *panicBulkBackend) GetResourceLastImportTimes(context.Context) iter.Seq2[ResourceLastImportTime, error] {
	return nil
}
