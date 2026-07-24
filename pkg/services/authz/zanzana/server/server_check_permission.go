package server

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	grpccodes "google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func (s *Server) CheckPermission(ctx context.Context, r *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error) {
	release, err := s.acquireSlot("CheckPermission", r.GetNamespace())
	if err != nil {
		return nil, err
	}
	defer release()

	if err := s.mtReconciler.EnsureNamespace(ctx, r.GetNamespace()); err != nil {
		return nil, fmt.Errorf("failed to reconcile namespace: %w", err)
	}

	res, err := s.checkPermission(ctx, r)
	if err != nil {
		s.logger.Error("failed to perform fallback permission check", "error", err, "namespace", r.GetNamespace(), "action", r.GetAction())
		return nil, errors.New("failed to perform fallback permission check")
	}
	return res, nil
}

func (s *Server) checkPermission(ctx context.Context, r *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error) {
	if err := authorize(ctx, r.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}
	if r.GetNamespace() == "" {
		return nil, status.Error(grpccodes.InvalidArgument, "namespace is required")
	}
	if r.GetAction() == "" {
		return nil, status.Error(grpccodes.InvalidArgument, "action is required")
	}
	if zanzana.ClassifyPermission(zanzana.RolePermission{Action: r.GetAction()}) == zanzana.Invalid {
		return nil, status.Error(grpccodes.InvalidArgument, "invalid action")
	}

	typ, identifier, err := types.ParseTypeID(r.GetSubject())
	if err != nil || identifier == "" || !types.IsIdentityType(typ, types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous) {
		return nil, status.Error(grpccodes.InvalidArgument, "unsupported canonical subject UID")
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}
	contextuals, err := s.getContextuals(r.GetSubject(), r.GetTeams())
	if err != nil {
		return nil, fmt.Errorf("failed to get contextual tuples: %w", err)
	}

	objects := make(map[string]struct{})
	if len(r.GetScopes()) == 0 {
		objects[zanzana.FallbackActionObject(r.GetAction())] = struct{}{}
	} else {
		var scoped []string
		for _, scope := range r.GetScopes() {
			if scope == "" {
				objects[zanzana.FallbackActionObject(r.GetAction())] = struct{}{}
				continue
			}
			scoped = append(scoped, scope)
		}
		candidates, err := zanzana.FallbackScopeCandidates(scoped...)
		if err != nil {
			return nil, status.Error(grpccodes.InvalidArgument, err.Error())
		}
		for _, scope := range candidates {
			objects[zanzana.FallbackPermissionObject(r.GetAction(), scope)] = struct{}{}
		}
	}

	checks := make([]*openfgav1.BatchCheckItem, 0, len(objects))
	i := 0
	for object := range objects {
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User: r.GetSubject(), Relation: zanzana.RelationGranted, Object: object,
			},
			CorrelationId: strconv.Itoa(i),
		})
		i++
	}
	if len(checks) == 0 {
		return &authzextv1.CheckPermissionResponse{}, nil
	}

	results, err := s.doBatchCheck(ctx, store, checks, contextuals)
	if err != nil {
		return nil, err
	}
	for _, result := range results {
		if result.GetError() != nil {
			return nil, fmt.Errorf("openfga fallback check failed: %s", result.GetError().GetMessage())
		}
		if result.GetAllowed() {
			return &authzextv1.CheckPermissionResponse{Allowed: true}, nil
		}
	}
	return &authzextv1.CheckPermissionResponse{}, nil
}
