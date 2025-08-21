package server

import (
	"context"
	"errors"
	"fmt"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Read")
	defer span.End()

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.Read", req.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.read(ctx, req)
	if err != nil {
		s.logger.Error("failed to perform read request", "error", err, "namespace", req.GetNamespace())
		return nil, errors.New("failed to perform read request")
	}

	return res, nil
}

func (s *Server) read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	if err := authorize(ctx, req.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	storeInf, err := s.getStoreInfo(ctx, req.Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
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
		s.logger.Error("failed to perform openfga Read request", "error", errors.Unwrap(err))
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
