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
	_ resource.BulkStoreClient             = (*writerClient)(nil)
	_ resource.BulkStore_BulkProcessClient = (*writerClient)(nil)

	errUnimplemented = errors.New("not implemented (BulkResourceWriter as BulkStoreClient shim)")
)

type writerClient struct {
	writer resource.BulkResourceWriter
	ctx    context.Context
}

// NewBulkResourceWriterClient wraps a BulkResourceWriter so that it can be used as a ResourceStoreClient
func NewBulkResourceWriterClient(writer resource.BulkResourceWriter) *writerClient {
	return &writerClient{writer: writer}
}

// Send implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) Send(req *resource.BulkRequest) error {
	return w.writer.Write(w.ctx, req.Key, req.Value)
}

// BulkProcess implements resource.ResourceStoreClient.
func (w *writerClient) BulkProcess(ctx context.Context, opts ...grpc.CallOption) (resource.BulkStore_BulkProcessClient, error) {
	if w.ctx != nil {
		return nil, fmt.Errorf("only one batch request supported")
	}
	w.ctx = ctx
	return w, nil
}

// CloseAndRecv implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) CloseAndRecv() (*resource.BulkResponse, error) {
	return w.writer.CloseWithResults()
}

// CloseSend implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) CloseSend() error {
	return w.writer.Close()
}

// Context implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) Context() context.Context {
	return w.ctx
}

// Header implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) Header() (metadata.MD, error) {
	return nil, errUnimplemented
}

// RecvMsg implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) RecvMsg(m any) error {
	return errUnimplemented
}

// SendMsg implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) SendMsg(m any) error {
	return errUnimplemented
}

// Trailer implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) Trailer() metadata.MD {
	return nil
}
