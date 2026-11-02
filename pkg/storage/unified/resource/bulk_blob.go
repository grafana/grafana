package resource

import (
	"context"
	"errors"
	"io"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// bulkBlobReader consumes exactly one declared upload, including its explicit
// EOF frame. It never reads ahead into the next upload or resource. The caller
// must validate the declaration and authorize its resource before reading.
// Upload success alone is insufficient: callers must also require completion
// before publishing a reference, since a backend may stop reading early.
type bulkBlobReader struct {
	ctx      context.Context
	recv     func() (*resourcepb.BulkRequest, error)
	upload   *resourcepb.BulkBlobUpload
	pending  []byte
	total    int64
	complete bool
	err      error
}

func (r *bulkBlobReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if r.err != nil {
		return 0, r.err
	}
	if err := r.ctx.Err(); err != nil {
		r.err = status.FromContextError(err).Err()
		return 0, r.err
	}
	if r.complete {
		return 0, io.EOF
	}
	if len(r.pending) == 0 {
		if err := r.nextChunk(); err != nil {
			r.err = err
			return 0, err
		}
		if r.complete {
			return 0, io.EOF
		}
	}
	n := copy(p, r.pending)
	r.pending = r.pending[n:]
	return n, nil
}

func (r *bulkBlobReader) nextChunk() error {
	req, err := recvBulkBlobFrame(r.ctx, r.recv)
	if errors.Is(err, io.EOF) {
		return status.Error(codes.InvalidArgument, "bulk stream ended before final blob chunk")
	}
	if err != nil {
		return err
	}
	if err := resourcepb.ValidateBulkBlobFrame(req); err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid blob frame: %s", err)
	}
	chunk := req.BlobChunk
	if chunk == nil {
		return status.Error(codes.InvalidArgument, "expected blob chunk before next resource")
	}
	if chunk.Name != r.upload.Name {
		return status.Error(codes.InvalidArgument, "blob chunks must follow declaration order")
	}
	if chunk.Last {
		if r.total != r.upload.Size {
			return status.Error(codes.InvalidArgument, "blob size does not match declaration")
		}
		r.complete = true
		return nil
	}
	if int64(len(chunk.Value)) > r.upload.Size-r.total {
		return status.Error(codes.InvalidArgument, "blob exceeds declared size")
	}
	r.total += int64(len(chunk.Value))
	r.pending = chunk.Value
	return nil
}

func recvBulkBlobFrame(ctx context.Context, recv func() (*resourcepb.BulkRequest, error)) (*resourcepb.BulkRequest, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	type result struct {
		msg *resourcepb.BulkRequest
		err error
	}
	ch := make(chan result, 1)
	// Recv has no per-call context. On timeout the endpoint must return, which
	// closes the underlying stream and unblocks this single pending receive.
	go func() {
		msg, err := recv()
		ch <- result{msg: msg, err: err}
	}()
	select {
	case received := <-ch:
		if err := ctx.Err(); err != nil {
			return nil, status.FromContextError(err).Err()
		}
		return received.msg, received.err
	case <-ctx.Done():
		return nil, status.FromContextError(ctx.Err()).Err()
	}
}
