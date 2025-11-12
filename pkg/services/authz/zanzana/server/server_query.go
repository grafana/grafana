package server

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func (s *Server) Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Query")
	defer span.End()

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.Query", req.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.query(ctx, req)
	if err != nil {
		s.logger.Error("failed to perform query request", "error", err, "namespace", req.GetNamespace())
		return nil, errors.New("failed to perform query request")
	}

	return res, nil
}

func (s *Server) query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	if err := authorize(ctx, req.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	storeInf, err := s.getStoreInfo(ctx, req.Namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	if req.Operation == nil {
		return nil, errors.New("operation cannot be nil")
	}

	switch op := req.Operation.Operation.(type) {
	case *authzextv1.QueryOperation_GetFolderParents:
		return s.queryFolderParents(ctx, storeInf, op.GetFolderParents)
	default:
		return nil, errors.New("unsupported query operation type")
	}
}

func (s *Server) queryFolderParents(ctx context.Context, store *storeInfo, req *authzextv1.GetFolderParentsQuery) (*authzextv1.QueryResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.queryFolderParents")
	defer span.End()

	if req.GetFolder() == "" {
		return nil, errors.New("folder UID cannot be empty")
	}

	// Get raw tuples from OpenFGA
	tuples, err := s.listFolderParents(ctx, store, req.GetFolder())
	if err != nil {
		return nil, fmt.Errorf("failed to list folder parents: %w", err)
	}

	// Extract parent UIDs from tuples (business logic now server-side)
	parentUIDs := make([]string, 0, len(tuples))
	for _, tuple := range tuples {
		// Extract UID from format "folder:UID" or "folder:UID#relation"
		userParts := strings.Split(tuple.Key.User, ":")
		if len(userParts) != 2 {
			return nil, fmt.Errorf("invalid user format: %s, expected format: folder:UID or folder:UID#relation", tuple.Key.User)
		}

		// Remove any relation part after #
		uidAndRelationParts := strings.Split(userParts[1], "#")
		if len(uidAndRelationParts) == 0 {
			return nil, fmt.Errorf("invalid user format: %s, expected format: folder:UID or folder:UID#relation", tuple.Key.User)
		}

		parentUIDs = append(parentUIDs, uidAndRelationParts[0])
	}

	return &authzextv1.QueryResponse{
		Result: &authzextv1.QueryResponse_FolderParents{
			FolderParents: &authzextv1.GetFolderParentsResult{
				ParentUids: parentUIDs,
			},
		},
	}, nil
}
