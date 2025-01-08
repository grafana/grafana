package server

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Read")
	defer span.End()

	storeInf, err := s.getStoreInfo(ctx, req.Namespace)
	if err != nil {
		return nil, err
	}

	readReq := &openfgav1.ReadRequest{
		StoreId:           storeInf.ID,
		PageSize:          req.GetPageSize(),
		ContinuationToken: req.GetContinuationToken(),
	}

	if req.TupleKey != nil {
		readReq.TupleKey = &openfgav1.ReadRequestTupleKey{
			User:     req.GetTupleKey().GetUser(),
			Relation: req.GetTupleKey().GetRelation(),
			Object:   req.GetTupleKey().GetObject(),
		}
	}

	res, err := s.openfga.Read(ctx, readReq)
	if err != nil {
		return nil, err
	}

	tuples := make([]*authzextv1.Tuple, 0)
	for _, t := range res.GetTuples() {
		tuples = append(tuples, &authzextv1.Tuple{
			Key:       common.ToAuthzExtTupleKey(t.GetKey()),
			Timestamp: t.GetTimestamp(),
		})
	}

	return &authzextv1.ReadResponse{
		Tuples:            tuples,
		ContinuationToken: res.GetContinuationToken(),
	}, nil
}
