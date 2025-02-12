package parquet

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.BatchStoreClient              = (*writerClient)(nil)
	_ resource.BatchStore_BatchProcessClient = (*writerClient)(nil)

	errUnimplemented = errors.New("not implemented (BatchResourceWriter as BatchStoreClient shim)")
)

type writerClient struct {
	writer resource.BatchResourceWriter
	ctx    context.Context
}

// NewBatchResourceWriterClient wraps a BatchResourceWriter so that it can be used as a ResourceStoreClient
func NewBatchResourceWriterClient(writer resource.BatchResourceWriter) *writerClient {
	return &writerClient{writer: writer}
}

// Send implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) Send(req *resource.BatchRequest) error {
	return w.writer.Write(w.ctx, req.Key, req.Value)
}

// BatchProcess implements resource.ResourceStoreClient.
func (w *writerClient) BatchProcess(ctx context.Context, opts ...grpc.CallOption) (resource.BatchStore_BatchProcessClient, error) {
	if w.ctx != nil {
		return nil, fmt.Errorf("only one batch request supported")
	}
	w.ctx = ctx
	return w, nil
}

// CloseAndRecv implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) CloseAndRecv() (*resource.BatchResponse, error) {
	return w.writer.CloseWithResults()
}

// CloseSend implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) CloseSend() error {
	return w.writer.Close()
}

// Context implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) Context() context.Context {
	return w.ctx
}

// Header implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) Header() (metadata.MD, error) {
	return nil, errUnimplemented
}

// RecvMsg implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) RecvMsg(m any) error {
	return errUnimplemented
}

// SendMsg implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) SendMsg(m any) error {
	return errUnimplemented
}

// Trailer implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) Trailer() metadata.MD {
	return nil
}
