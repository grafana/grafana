package resource

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/metadata"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBatchRunnerNextBatchHonorsMaxItemsAndEOF(t *testing.T) {
	restore := setBulkBatchOptionsForTesting(bulkBatchOptions{
		MaxItems: 2,
		MaxBytes: 1 << 20,
	})
	t.Cleanup(restore)

	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
		newTestBulkRequest("item-3"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{requests: reqs}, reqs[0].Key)

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
	restore := setBulkBatchOptionsForTesting(bulkBatchOptions{
		MaxItems: 100,
		MaxBytes: 1 << 20,
		MaxIdle:  5 * time.Millisecond,
	})
	t.Cleanup(restore)

	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{
		requests: reqs,
		delays:   []time.Duration{0, 20 * time.Millisecond},
	}, reqs[0].Key)

	require.True(t, runner.NextBatch())
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-1", runner.Batch()[0].Key.Name)

	require.True(t, runner.NextBatch())
	require.Len(t, runner.Batch(), 1)
	require.Equal(t, "item-2", runner.Batch()[0].Key.Name)

	require.False(t, runner.NextBatch())
}

func TestBatchRunnerNextPreservesSingleItemIteration(t *testing.T) {
	restore := setBulkBatchOptionsForTesting(bulkBatchOptions{
		MaxItems: 2,
		MaxBytes: 1 << 20,
	})
	t.Cleanup(restore)

	reqs := []*resourcepb.BulkRequest{
		newTestBulkRequest("item-1"),
		newTestBulkRequest("item-2"),
		newTestBulkRequest("item-3"),
	}
	runner := newTestBatchRunner(&testBulkProcessServer{requests: reqs}, reqs[0].Key)

	got := make([]string, 0, len(reqs))
	for runner.Next() {
		require.False(t, runner.RollbackRequested())
		got = append(got, runner.Request().Key.Name)
	}

	require.Equal(t, []string{"item-1", "item-2", "item-3"}, got)
}

func TestBatchRunnerNextBatchRollbackOnAccessError(t *testing.T) {
	restore := setBulkBatchOptionsForTesting(bulkBatchOptions{
		MaxItems: 10,
		MaxBytes: 1 << 20,
	})
	t.Cleanup(restore)

	req := newTestBulkRequest("item-1")
	runner := &batchRunner{
		stream:  &testBulkProcessServer{requests: []*resourcepb.BulkRequest{req}},
		checker: map[string]authlib.ItemChecker{},
		span:    trace.SpanFromContext(context.Background()),
	}

	require.True(t, runner.NextBatch())
	require.Empty(t, runner.Batch())
	require.True(t, runner.RollbackRequested())
	require.ErrorContains(t, runner.err, "missing access control")
}

func newTestBatchRunner(stream resourcepb.BulkStore_BulkProcessServer, key *resourcepb.ResourceKey) *batchRunner {
	return &batchRunner{
		stream: stream,
		checker: map[string]authlib.ItemChecker{
			NSGR(key): func(string, string) bool { return true },
		},
		span: trace.SpanFromContext(context.Background()),
	}
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
