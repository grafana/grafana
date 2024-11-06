package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

func (s *Server) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Read")
	defer span.End()

	storeId, err := s.getStoreId(req.Namespace)
	if err != nil {
		return nil, err
	}

	res, err := s.openfga.Read(ctx, &openfgav1.ReadRequest{
		StoreId: storeId,
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

	storeId, err := s.getStoreId(req.Namespace)
	if err != nil {
		return nil, err
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

	_, err = s.openfga.Write(ctx, &openfgav1.WriteRequest{
		// FIXME: provide AuthorizationModelId
		StoreId: storeId,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: writeTuples,
		},
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: deleteTuples,
		},
	})
	if err != nil {
		return nil, err
	}

	return &authzextv1.WriteResponse{}, nil
}
