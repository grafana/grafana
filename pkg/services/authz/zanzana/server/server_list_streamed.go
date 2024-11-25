package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

var _ grpc.ServerStream = (*streamServer)(nil)

func NewStreamServer(ctx context.Context) *streamServer {
	channel := make(chan *openfgav1.StreamedListObjectsResponse, streamedBufferSize)
	return &streamServer{
		ctx:     ctx,
		channel: channel,
	}
}

const streamedBufferSize = 100

// streamServer implements grpc.ServerStream
type streamServer struct {
	ctx     context.Context
	channel chan *openfgav1.StreamedListObjectsResponse
}

func (s *streamServer) Send(m *openfgav1.StreamedListObjectsResponse) error {
	s.channel <- m
	return nil
}

func (s *streamServer) Recv() (*openfgav1.StreamedListObjectsResponse, error) {
	m := <-s.channel
	return m, nil
}

func (s *streamServer) Context() context.Context {
	return s.ctx
}

func (s *streamServer) RecvMsg(m any) error {
	return nil
}

func (s *streamServer) SendHeader(metadata.MD) error {
	return nil
}

func (s *streamServer) SendMsg(m any) error {
	return nil
}

func (s *streamServer) SetHeader(metadata.MD) error {
	return nil
}

func (s *streamServer) SetTrailer(metadata.MD) {
	return
}

func (s *Server) streamedListObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*streamServer, error) {
	r := &openfgav1.StreamedListObjectsRequest{
		StoreId:              req.GetStoreId(),
		AuthorizationModelId: req.GetAuthorizationModelId(),
		Type:                 req.GetType(),
		Relation:             req.GetRelation(),
		User:                 req.GetUser(),
		Context:              req.GetContext(),
	}

	srv := NewStreamServer(ctx)
	err := s.openfga.StreamedListObjects(r, srv)
	if err != nil {
		return nil, err
	}

	return srv, nil
}

func (s *Server) listObjectsStreamed(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	stream, err := s.streamedListObjects(ctx, req)
	if err != nil {
		return nil, err
	}

	done := make(chan struct{})
	result := make([]string, 0)
	go func() {
		for {
			m, err := stream.Recv()
			if err != nil {
				break
			}
			result = append(result, m.Object)
		}
		done <- struct{}{}
	}()
	<-done

	return &openfgav1.ListObjectsResponse{Objects: result}, nil
}
