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
	return s.listObjectsWithStreamCached(ctx, req)
}

func (s *Server) listObjectsWithStreamCached(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ctx, span := tracer.Start(ctx, "server.listObjectsWithStreamCached")
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
	ctx, span := tracer.Start(ctx, "server.listObjectsWithStream")
	defer span.End()

	r := &openfgav1.StreamedListObjectsRequest{
		StoreId:              req.GetStoreId(),
		AuthorizationModelId: req.GetAuthorizationModelId(),
		Type:                 req.GetType(),
		Relation:             req.GetRelation(),
		User:                 req.GetUser(),
		Context:              req.GetContext(),
		ContextualTuples:     req.ContextualTuples,
	}

	stream, err := s.openfgaClient.StreamedListObjects(ctx, r)
	if err != nil {
		return nil, err
	}

	var objects []string
	for {
		res, err := stream.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		objects = append(objects, res.GetObject())
	}

	return &openfgav1.ListObjectsResponse{
		Objects: objects,
	}, nil
}

func getRequestHash(req *openfgav1.ListObjectsRequest) (string, error) {
	hash := fnv.New64a()
	_, err := hash.Write([]byte(req.String()))
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(hash.Sum(nil)), nil
}
