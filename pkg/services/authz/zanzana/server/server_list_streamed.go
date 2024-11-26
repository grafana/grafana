package server

import (
	"context"
	"errors"
	"io"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func (s *Server) streamedListObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	r := &openfgav1.StreamedListObjectsRequest{
		StoreId:              req.GetStoreId(),
		AuthorizationModelId: req.GetAuthorizationModelId(),
		Type:                 req.GetType(),
		Relation:             req.GetRelation(),
		User:                 req.GetUser(),
		Context:              req.GetContext(),
	}

	clientStream, err := s.openfgaClient.StreamedListObjects(ctx, r)
	if err != nil {
		return nil, err
	}

	done := make(chan struct{})
	var streamedObjectIDs []string
	var streamingErr error
	var streamingResp *openfgav1.StreamedListObjectsResponse
	go func() {
		for {
			streamingResp, streamingErr = clientStream.Recv()
			if streamingErr == nil {
				streamedObjectIDs = append(streamedObjectIDs, streamingResp.GetObject())
			} else {
				if errors.Is(streamingErr, io.EOF) {
					streamingErr = nil
				}
				break
			}
		}
		done <- struct{}{}
	}()
	<-done

	if streamingErr != nil {
		return nil, streamingErr
	}

	return &openfgav1.ListObjectsResponse{
		Objects: streamedObjectIDs,
	}, nil
}
