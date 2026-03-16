package migrations

import (
	"bytes"
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBulkProcessBatchingClientFlushesBatches(t *testing.T) {
	tests := []struct {
		name        string
		opts        bulkProcessBatchOptions
		valueSizes  []int
		wantBatches []int
	}{
		{
			name:        "flushes by max items",
			opts:        bulkProcessBatchOptions{MaxItems: 2, MaxBytes: 1024},
			valueSizes:  []int{8, 8, 8},
			wantBatches: []int{2, 1},
		},
		{
			name:        "flushes by max bytes",
			opts:        bulkProcessBatchOptions{MaxItems: 10, MaxBytes: 16},
			valueSizes:  []int{8, 8, 8},
			wantBatches: []int{2, 1},
		},
		{
			name:        "flushes trailing batch on close",
			opts:        bulkProcessBatchOptions{MaxItems: 10, MaxBytes: 1024},
			valueSizes:  []int{8},
			wantBatches: []int{1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stream := &recordingBulkProcessBatchedClient{
				response: &resourcepb.BulkResponse{Processed: 123},
			}
			client := newBulkProcessBatchingClient(stream, tt.opts)

			for i, size := range tt.valueSizes {
				err := client.Send(newTestBulkRequest(fmt.Sprintf("item-%d", i), size))
				require.NoError(t, err)
			}

			response, err := client.CloseAndRecv()
			require.NoError(t, err)
			require.Equal(t, int64(123), response.Processed)

			got := make([]int, 0, len(stream.sent))
			for _, batch := range stream.sent {
				got = append(got, len(batch.Items))
			}
			require.Equal(t, tt.wantBatches, got)
		})
	}
}

func TestBulkProcessBatchingClientRejectsNilRequest(t *testing.T) {
	stream := &recordingBulkProcessBatchedClient{}
	client := newBulkProcessBatchingClient(stream, bulkProcessBatchOptions{MaxItems: 2, MaxBytes: 32})

	err := client.Send(nil)
	require.ErrorContains(t, err, "missing bulk request")
	require.Empty(t, stream.sent)
}

type recordingBulkProcessBatchedClient struct {
	sent     []*resourcepb.BulkRequestBatch
	response *resourcepb.BulkResponse
}

func (c *recordingBulkProcessBatchedClient) Send(batch *resourcepb.BulkRequestBatch) error {
	items := append([]*resourcepb.BulkRequest(nil), batch.Items...)
	c.sent = append(c.sent, &resourcepb.BulkRequestBatch{Items: items})
	return nil
}

func (c *recordingBulkProcessBatchedClient) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	if c.response == nil {
		return &resourcepb.BulkResponse{}, nil
	}
	return c.response, nil
}

func (c *recordingBulkProcessBatchedClient) Header() (metadata.MD, error) {
	return nil, nil
}

func (c *recordingBulkProcessBatchedClient) Trailer() metadata.MD {
	return nil
}

func (c *recordingBulkProcessBatchedClient) CloseSend() error {
	return nil
}

func (c *recordingBulkProcessBatchedClient) Context() context.Context {
	return context.Background()
}

func (c *recordingBulkProcessBatchedClient) SendMsg(any) error {
	return nil
}

func (c *recordingBulkProcessBatchedClient) RecvMsg(any) error {
	return nil
}

func newTestBulkRequest(name string, valueSize int) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "shorturl.grafana.app",
			Resource:  "shorturls",
			Name:      name,
		},
		Action: resourcepb.BulkRequest_ADDED,
		Value:  bytes.Repeat([]byte{'x'}, valueSize),
	}
}
