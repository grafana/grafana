package server

import (
	"context"
	"encoding/base64"
	"errors"
	"hash/fnv"
	"io"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func (s *Server) streamedListObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	if !s.cfg.CheckQueryCache {
		return s.listObjectsWithStream(ctx, req)
	}
	return s.streamedListObjectsCached(ctx, req)
}

func (s *Server) streamedListObjectsCached(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.streamedListObjectsCached")
	defer span.End()

	reqHash, err := getRequestHash(req)
	if err != nil {
		return nil, err
	}

	if res, ok := s.cache.Get(reqHash); ok {
		return res.(*openfgav1.ListObjectsResponse), nil
	}

	res, err := s.listObjectsWithStream(ctx, req)
	if err != nil {
		return nil, err
	}
	s.cache.Set(reqHash, res, 0)
	return res, nil
}

func (s *Server) listObjectsWithStream(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.listObjectsWithStream")
	defer span.End()

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

func getRequestHash(req *openfgav1.ListObjectsRequest) (string, error) {
	if req == nil {
		return "", errors.New("request must not be empty")
	}

	hash := fnv.New64a()
	_, err := hash.Write([]byte(req.String()))
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(hash.Sum(nil)), nil
}
