package server

import (
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const userPermissionsChunkSize = 1000

func (s *Server) GetUserPermissions(req *authzv1.GetUserPermissionsRequest, stream authzv1.AuthzService_GetUserPermissionsServer) error {
	ctx, span := s.tracer.Start(stream.Context(), "server.GetUserPermissions")
	defer span.End()
	defer func(start time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("GetUserPermissions").Observe(time.Since(start).Seconds())
	}(time.Now())
	if req.GetNamespace() == "" {
		return status.Error(codes.InvalidArgument, "namespace is required")
	}
	if err := authorize(ctx, req.GetNamespace(), s.cfg); err != nil {
		return err
	}
	if _, err := types.ParseNamespace(req.GetNamespace()); err != nil {
		return status.Error(codes.InvalidArgument, "invalid namespace")
	}
	kind, uid, err := types.ParseTypeID(req.GetSubject())
	if err != nil || uid == "" {
		return status.Error(codes.InvalidArgument, "a typed subject is required")
	}
	if !types.IsIdentityType(kind, types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous, types.TypeRenderService) {
		return status.Error(codes.PermissionDenied, "unsupported identity type")
	}
	release, err := s.acquireSlot("GetUserPermissions", req.GetNamespace())
	if err != nil {
		return err
	}
	defer release()

	resolved, err := s.resolveUserPermissions(ctx, req)
	if err != nil {
		return err
	}
	permissions := make([]*authzv1.UserPermission, 0, len(resolved))
	for _, permission := range resolved {
		permissions = append(permissions, &authzv1.UserPermission{Action: permission.Action, Scope: permission.Scope})
	}
	// Resolve all grants and scopes before sending. A failed evaluation must never
	// publish a partial permission result as a successful stream.
	for start := 0; start < len(permissions); start += userPermissionsChunkSize {
		if err := ctx.Err(); err != nil {
			return err
		}
		end := min(start+userPermissionsChunkSize, len(permissions))
		if err := stream.Send(&authzv1.GetUserPermissionsResponse{Permissions: permissions[start:end]}); err != nil {
			return err
		}
	}
	return ctx.Err()
}
