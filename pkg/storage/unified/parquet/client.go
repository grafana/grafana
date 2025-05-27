package parquet

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	_ resourcepb.BulkStoreClient             = (*writerClient)(nil)
	_ resourcepb.BulkStore_BulkProcessClient = (*writerClient)(nil)

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
func (w *writerClient) Send(req *resourcepb.BulkRequest) error {
	return w.writer.Write(w.ctx, req.Key, req.Value)
}

// BulkProcess implements resource.ResourceStoreClient.
func (w *writerClient) BulkProcess(ctx context.Context, _ ...grpc.CallOption) (resourcepb.BulkStore_BulkProcessClient, error) {
	if w.ctx != nil {
		return nil, fmt.Errorf("only one batch request supported")
	}
	w.ctx = ctx
	return w, nil
}

// CloseAndRecv implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) CloseAndRecv() (*resourcepb.BulkResponse, error) {
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
func (w *writerClient) RecvMsg(_ any) error {
	return errUnimplemented
}

// SendMsg implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) SendMsg(_ any) error {
	return errUnimplemented
}

// Trailer implements resource.ResourceStore_BulkProcessClient.
func (w *writerClient) Trailer() metadata.MD {
	return nil
}
