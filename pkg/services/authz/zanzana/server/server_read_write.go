package server

import (
	"context"
	"errors"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

func (s *Server) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Read")
	defer span.End()

	var storeInf *storeInfo
	var err error
	storeInf, err = s.getStoreInfo(req.Namespace)
	if errors.Is(err, errStoreNotFound) || storeInf.AuthorizationModelId == "" {
		storeInf, err = s.initNamespaceStore(ctx, req.Namespace)
	}
	if err != nil {
		return nil, err
	}

	res, err := s.openfga.Read(ctx, &openfgav1.ReadRequest{
		StoreId: storeInf.Id,
		TupleKey: &openfgav1.ReadRequestTupleKey{
			User:     req.GetTupleKey().GetUser(),
			Relation: req.GetTupleKey().GetRelation(),
			Object:   req.GetTupleKey().GetObject(),
		},
		PageSize:          req.GetPageSize(),
		ContinuationToken: req.GetContinuationToken(),
	})
	if err != nil {
		return nil, err
	}

	tuples := make([]*authzextv1.Tuple, 0)
	for _, t := range res.GetTuples() {
		tuples = append(tuples, &authzextv1.Tuple{
			Key: &authzextv1.TupleKey{
				User:     t.GetKey().GetUser(),
				Relation: t.GetKey().GetRelation(),
				Object:   t.GetKey().GetObject(),
			},
			Timestamp: t.GetTimestamp(),
		})
	}

	return &authzextv1.ReadResponse{
		Tuples:            tuples,
		ContinuationToken: res.GetContinuationToken(),
	}, nil
}

func (s *Server) Write(ctx context.Context, req *authzextv1.WriteRequest) (*authzextv1.WriteResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Write")
	defer span.End()

	var storeInf *storeInfo
	var err error
	storeInf, err = s.getStoreInfo(req.Namespace)
	if errors.Is(err, errStoreNotFound) || storeInf.AuthorizationModelId == "" {
		storeInf, err = s.initNamespaceStore(ctx, req.Namespace)
	}
	if err != nil {
		return nil, err
	}

	if storeInf.AuthorizationModelId == "" {
		return nil, errAuthorizationModelNotInitialized
	}

	writeTuples := make([]*openfgav1.TupleKey, 0)
	for _, t := range req.GetWrites().GetTupleKeys() {
		writeTuples = append(writeTuples, &openfgav1.TupleKey{
			User:     t.GetUser(),
			Relation: t.GetRelation(),
			Object:   t.GetObject(),
		})
	}

	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)
	for _, t := range req.GetDeletes().GetTupleKeys() {
		deleteTuples = append(deleteTuples, &openfgav1.TupleKeyWithoutCondition{
			User:     t.GetUser(),
			Relation: t.GetRelation(),
			Object:   t.GetObject(),
		})
	}

	writeReq := &openfgav1.WriteRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
	}
	if len(writeTuples) > 0 {
		writeReq.Writes = &openfgav1.WriteRequestWrites{
			TupleKeys: writeTuples,
		}
	}
	if len(deleteTuples) > 0 {
		writeReq.Deletes = &openfgav1.WriteRequestDeletes{
			TupleKeys: deleteTuples,
		}
	}

	_, err = s.openfga.Write(ctx, writeReq)
	if err != nil {
		return nil, err
	}

	return &authzextv1.WriteResponse{}, nil
}
