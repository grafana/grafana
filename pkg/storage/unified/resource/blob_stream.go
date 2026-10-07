package resource

import (
	"context"
	"errors"
	"io"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	blobStreamChunkSize = 64 << 10
	blobStreamMaxSize   = 64 << 20
	blobStreamTimeout   = 2 * time.Minute
	blobStreamPerTenant = 2
)

// StreamingBlobSupport writes and reads the existing blob format incrementally.
// Backends without this interface cannot use the new transport.
type StreamingBlobSupport interface {
	PutResourceBlobStream(context.Context, *resourcepb.PutBlobRequest, io.Reader) (*resourcepb.PutBlobResponse, error)
	GetResourceBlobStream(context.Context, *resourcepb.ResourceKey, *utils.BlobInfo, func(string) (io.Writer, error)) error
}

type blobTransfers struct {
	mu     sync.Mutex
	active map[string]int
}

func newBlobTransfers() *blobTransfers { return &blobTransfers{active: make(map[string]int)} }

func (s *server) acquireBlobTransfer(tenant string) (func(), error) {
	s.blobTransfers.mu.Lock()
	defer s.blobTransfers.mu.Unlock()
	if s.blobTransfers.active[tenant] >= blobStreamPerTenant {
		return nil, status.Error(codes.ResourceExhausted, "too many blob transfers for tenant")
	}
	s.blobTransfers.active[tenant]++
	return func() {
		s.blobTransfers.mu.Lock()
		defer s.blobTransfers.mu.Unlock()
		s.blobTransfers.active[tenant]--
		if s.blobTransfers.active[tenant] == 0 {
			delete(s.blobTransfers.active, tenant)
		}
	}, nil
}

func (s *server) PutBlobStream(stream resourcepb.BlobStoreStreaming_PutBlobStreamServer) error {
	first, err := stream.Recv()
	if err != nil {
		return err
	}
	if len(first.Value) != 0 || first.Method != resourcepb.PutBlobRequest_GRPC {
		return status.Error(codes.InvalidArgument, "first message must contain blob metadata only")
	}
	if failure := s.authorizeBlobPut(stream.Context(), first); failure != nil {
		return stream.SendAndClose(&resourcepb.PutBlobResponse{Error: failure})
	}
	backend, ok := s.blob.(StreamingBlobSupport)
	if !ok {
		return status.Error(codes.Unimplemented, "blob backend does not support streaming")
	}
	release, err := s.acquireBlobTransfer(first.Resource.Namespace)
	if err != nil {
		return err
	}
	defer release()
	if !s.trackWrite() {
		return errStopping
	}
	defer s.inflight.Done()
	ctx, cancel := context.WithTimeout(stream.Context(), blobStreamTimeout)
	defer cancel()
	reader := &blobStreamReader{ctx: ctx, recv: stream.Recv}
	rsp, err := backend.PutResourceBlobStream(ctx, first, reader)
	if err != nil {
		return err
	}
	return stream.SendAndClose(rsp)
}

func (s *server) GetBlobStream(req *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
	info, failure := s.resolveBlobGet(stream.Context(), req)
	if failure != nil {
		return stream.Send(&resourcepb.GetBlobResponse{Error: failure})
	}
	backend, ok := s.blob.(StreamingBlobSupport)
	if !ok {
		return status.Error(codes.Unimplemented, "blob backend does not support streaming")
	}
	release, err := s.acquireBlobTransfer(req.Resource.Namespace)
	if err != nil {
		return err
	}
	defer release()
	ctx, cancel := context.WithTimeout(stream.Context(), blobStreamTimeout)
	defer cancel()
	return backend.GetResourceBlobStream(ctx, req.Resource, info, func(contentType string) (io.Writer, error) {
		if err := stream.Send(&resourcepb.GetBlobResponse{ContentType: contentType}); err != nil {
			return nil, err
		}
		return &blobStreamWriter{ctx: ctx, send: stream.Send}, nil
	})
}

type blobStreamReader struct {
	ctx     context.Context
	recv    func() (*resourcepb.PutBlobRequest, error)
	pending []byte
	total   int64
}

func (r *blobStreamReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if err := r.ctx.Err(); err != nil {
		return 0, status.FromContextError(err).Err()
	}
	if len(r.pending) == 0 {
		// Recv cannot take a context; returning from the RPC closes the stream
		// and unblocks this one pending receive when the transfer times out.
		type result struct {
			msg *resourcepb.PutBlobRequest
			err error
		}
		ch := make(chan result, 1)
		go func() { msg, err := r.recv(); ch <- result{msg, err} }()
		var received result
		select {
		case received = <-ch:
		case <-r.ctx.Done():
			return 0, status.FromContextError(r.ctx.Err()).Err()
		}
		if errors.Is(received.err, io.EOF) && r.total == 0 {
			return 0, status.Error(codes.InvalidArgument, "empty blob")
		}
		if received.err != nil {
			return 0, received.err
		}
		msg := received.msg
		if msg.Resource != nil || msg.Folder != "" || msg.ContentType != "" || msg.Method != resourcepb.PutBlobRequest_GRPC || len(msg.Value) == 0 {
			return 0, status.Error(codes.InvalidArgument, "chunk must contain only value")
		}
		if len(msg.Value) > blobStreamChunkSize || int64(len(msg.Value)) > blobStreamMaxSize-r.total {
			return 0, status.Error(codes.ResourceExhausted, "blob or chunk too large")
		}
		r.total += int64(len(msg.Value))
		r.pending = msg.Value
	}
	n := copy(p, r.pending)
	r.pending = r.pending[n:]
	return n, nil
}

type blobStreamWriter struct {
	ctx   context.Context
	send  func(*resourcepb.GetBlobResponse) error
	total int64
}

func (w *blobStreamWriter) Write(p []byte) (int, error) {
	if int64(len(p)) > blobStreamMaxSize-w.total {
		return 0, status.Error(codes.ResourceExhausted, "blob too large")
	}
	written := 0
	for len(p) > 0 {
		if err := w.ctx.Err(); err != nil {
			return written, status.FromContextError(err).Err()
		}
		n := min(len(p), blobStreamChunkSize)
		// The in-process transport may retain message buffers.
		chunk := append([]byte(nil), p[:n]...)
		ch := make(chan error, 1)
		go func() { ch <- w.send(&resourcepb.GetBlobResponse{Value: chunk}) }()
		select {
		case err := <-ch:
			if err != nil {
				return written, err
			}
		case <-w.ctx.Done():
			return written, status.FromContextError(w.ctx.Err()).Err()
		}
		w.total += int64(n)
		written += n
		p = p[n:]
	}
	return written, nil
}
