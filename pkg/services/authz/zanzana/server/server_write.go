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

func (s *Server) Write(ctx context.Context, req *authzextv1.WriteRequest) (*authzextv1.WriteResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Write")
	defer span.End()

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.Write", req.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.write(ctx, req)
	if err != nil {
		s.logger.Error("failed to perform write request", "error", err, "namespace", req.GetNamespace())
		return nil, errors.New("failed to perform write request")
	}

	return res, nil
}

func (s *Server) write(ctx context.Context, req *authzextv1.WriteRequest) (*authzextv1.WriteResponse, error) {
	if err := authorize(ctx, req.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	storeInf, err := s.getStoreInfo(ctx, req.Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	writeTuples := make([]*openfgav1.TupleKey, 0)
	for _, t := range req.GetWrites().GetTupleKeys() {
		writeTuples = append(writeTuples, common.ToOpenFGATupleKey(t))
	}

	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)
	for _, t := range req.GetDeletes().GetTupleKeys() {
		deleteTuples = append(deleteTuples, common.ToOpenFGATupleKeyWithoutCondition(t))
	}

	writeReq := &openfgav1.WriteRequest{
		StoreId:              storeInf.ID,
		AuthorizationModelId: storeInf.ModelID,
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
		s.logger.Error("failed to perform openfga Write request", "error", errors.Unwrap(err))
		return nil, err
	}

	return &authzextv1.WriteResponse{}, nil
}
