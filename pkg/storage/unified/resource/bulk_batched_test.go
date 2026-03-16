package resource

import (
	"context"
	"fmt"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBulkProcessBatchFlattenerRecv(t *testing.T) {
	tests := []struct {
		name      string
		batches   []*resourcepb.BulkRequestBatch
		wantNames []string
		wantErr   string
	}{
		{
			name: "flattens multiple batches",
			batches: []*resourcepb.BulkRequestBatch{
				{Items: []*resourcepb.BulkRequest{newTestBulkRequest("item-1"), newTestBulkRequest("item-2")}},
				{Items: []*resourcepb.BulkRequest{newTestBulkRequest("item-3")}},
			},
			wantNames: []string{"item-1", "item-2", "item-3"},
		},
		{
			name: "rejects empty batch",
			batches: []*resourcepb.BulkRequestBatch{
				{Items: nil},
			},
			wantErr: "missing request batch",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flattener := &bulkProcessBatchFlattener{
				BulkStore_BulkProcessBatchedServer: &testBulkProcessBatchedServer{batches: tt.batches},
			}

			if tt.wantErr != "" {
				_, err := flattener.Recv()
				require.ErrorContains(t, err, tt.wantErr)
				return
			}

			got := make([]string, 0, len(tt.wantNames))
			for {
				req, err := flattener.Recv()
				if err == io.EOF {
					break
				}
				require.NoError(t, err)
				got = append(got, req.Key.Name)
			}

			require.Equal(t, tt.wantNames, got)
		})
	}
}

type testBulkProcessBatchedServer struct {
	batches []*resourcepb.BulkRequestBatch
	index   int
}

func (s *testBulkProcessBatchedServer) SendAndClose(*resourcepb.BulkResponse) error {
	return nil
}

func (s *testBulkProcessBatchedServer) Recv() (*resourcepb.BulkRequestBatch, error) {
	if s.index >= len(s.batches) {
		return nil, io.EOF
	}

	batch := s.batches[s.index]
	s.index++
	return batch, nil
}

func (s *testBulkProcessBatchedServer) SetHeader(metadata.MD) error {
	return nil
}

func (s *testBulkProcessBatchedServer) SendHeader(metadata.MD) error {
	return nil
}

func (s *testBulkProcessBatchedServer) SetTrailer(metadata.MD) {}

func (s *testBulkProcessBatchedServer) Context() context.Context {
	return context.Background()
}

func (s *testBulkProcessBatchedServer) SendMsg(any) error {
	return nil
}

func (s *testBulkProcessBatchedServer) RecvMsg(any) error {
	return nil
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
		Value:  []byte(fmt.Sprintf("{\"metadata\":{\"name\":\"%s\"}}", name)),
	}
}
