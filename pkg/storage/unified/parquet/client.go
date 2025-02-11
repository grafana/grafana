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
	_ resource.ResourceStoreClient              = (*writerClient)(nil)
	_ resource.ResourceStore_BatchProcessClient = (*writerClient)(nil)

	unimplemented = errors.New("not implemented (parquet client stub)")
)

type writerClient struct {
	writer resource.BatchResourceWriter
	ctx    context.Context
}

func NewBatchResourceWriterClient(writer resource.BatchResourceWriter) *writerClient {
	return &writerClient{writer: writer}
}

// Send implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) Send(req *resource.BatchRequest) error {
	return w.writer.Write(w.ctx, req.Key, req.Value)
}

// BatchProcess implements resource.ResourceStoreClient.
func (w *writerClient) BatchProcess(ctx context.Context, opts ...grpc.CallOption) (resource.ResourceStore_BatchProcessClient, error) {
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
	return nil, unimplemented
}

// RecvMsg implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) RecvMsg(m any) error {
	return unimplemented
}

// SendMsg implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) SendMsg(m any) error {
	return unimplemented
}

// Trailer implements resource.ResourceStore_BatchProcessClient.
func (w *writerClient) Trailer() metadata.MD {
	return nil
}

// Create implements resource.ResourceStoreClient.
func (w *writerClient) Create(ctx context.Context, in *resource.CreateRequest, opts ...grpc.CallOption) (*resource.CreateResponse, error) {
	return nil, unimplemented
}

// Delete implements resource.ResourceStoreClient.
func (w *writerClient) Delete(ctx context.Context, in *resource.DeleteRequest, opts ...grpc.CallOption) (*resource.DeleteResponse, error) {
	return nil, unimplemented
}

// List implements resource.ResourceStoreClient.
func (w *writerClient) List(ctx context.Context, in *resource.ListRequest, opts ...grpc.CallOption) (*resource.ListResponse, error) {
	return nil, unimplemented
}

// Read implements resource.ResourceStoreClient.
func (w *writerClient) Read(ctx context.Context, in *resource.ReadRequest, opts ...grpc.CallOption) (*resource.ReadResponse, error) {
	return nil, unimplemented
}

// Restore implements resource.ResourceStoreClient.
func (w *writerClient) Restore(ctx context.Context, in *resource.RestoreRequest, opts ...grpc.CallOption) (*resource.RestoreResponse, error) {
	return nil, unimplemented
}

// Update implements resource.ResourceStoreClient.
func (w *writerClient) Update(ctx context.Context, in *resource.UpdateRequest, opts ...grpc.CallOption) (*resource.UpdateResponse, error) {
	return nil, unimplemented
}

// Watch implements resource.ResourceStoreClient.
func (w *writerClient) Watch(ctx context.Context, in *resource.WatchRequest, opts ...grpc.CallOption) (resource.ResourceStore_WatchClient, error) {
	return nil, unimplemented
}
