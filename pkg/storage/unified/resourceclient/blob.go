package resourceclient

import (
	"context"
	"errors"
	"io"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	blobChunkSize = 64 << 10
	blobMaxSize   = 64 << 20
)

// blobStoreClient preserves the caller interface while using streaming RPCs.
type blobStoreClient struct {
	streaming resourcepb.BlobStoreStreamingClient
}

func newBlobStoreClient(cc grpc.ClientConnInterface) resourcepb.BlobStoreClient {
	return &blobStoreClient{streaming: resourcepb.NewBlobStoreStreamingClient(cc)}
}

func (c *blobStoreClient) PutBlob(ctx context.Context, req *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	if req != nil && len(req.Value) > blobMaxSize {
		return nil, status.Error(codes.ResourceExhausted, "blob too large")
	}
	return c.putBlobStream(ctx, req, opts...)
}

func (c *blobStoreClient) putBlobStream(ctx context.Context, req *resourcepb.PutBlobRequest, opts ...grpc.CallOption) (*resourcepb.PutBlobResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "missing blob request")
	}
	if req.Method != resourcepb.PutBlobRequest_GRPC {
		return nil, status.Error(codes.InvalidArgument, "only inline blob uploads are supported")
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stream, err := c.streaming.PutBlobStream(ctx, opts...)
	if err != nil {
		return nil, err
	}
	metadata := &resourcepb.PutBlobRequest{
		Resource: req.Resource, Method: req.Method, ContentType: req.ContentType, Folder: req.Folder,
	}
	if err := stream.Send(metadata); err != nil {
		if errors.Is(err, io.EOF) {
			return stream.CloseAndRecv()
		}
		return nil, err
	}
	for remaining := req.Value; len(remaining) > 0; {
		n := min(len(remaining), blobChunkSize)
		if err := stream.Send(&resourcepb.PutBlobRequest{Value: remaining[:n]}); err != nil {
			// Send returns EOF when the server rejects a stream early; receiving
			// its final response preserves the actual status or ErrorResult.
			if errors.Is(err, io.EOF) {
				return stream.CloseAndRecv()
			}
			return nil, err
		}
		remaining = remaining[n:]
	}
	return stream.CloseAndRecv()
}

func (c *blobStoreClient) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest, opts ...grpc.CallOption) (*resourcepb.GetBlobResponse, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stream, err := c.streaming.GetBlobStream(ctx, req, opts...)
	if err != nil {
		return nil, err
	}
	var result *resourcepb.GetBlobResponse
	for {
		rsp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if result == nil {
				return nil, status.Error(codes.DataLoss, "missing blob metadata")
			}
			return result, nil
		}
		if err != nil {
			return nil, err
		}
		if result == nil {
			if len(rsp.Value) != 0 {
				return nil, status.Error(codes.DataLoss, "first blob response must contain metadata only")
			}
			result = rsp
			continue
		}
		if rsp.Url != "" || rsp.ContentType != "" || len(rsp.Value) == 0 || result.Url != "" {
			return nil, status.Error(codes.DataLoss, "blob chunk must contain only value")
		}
		if len(rsp.Value) > blobChunkSize || len(rsp.Value) > blobMaxSize-len(result.Value) {
			return nil, status.Error(codes.ResourceExhausted, "blob or chunk too large")
		}
		result.Value = append(result.Value, rsp.Value...)
	}
}
