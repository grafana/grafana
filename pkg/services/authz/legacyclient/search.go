package legacyclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var (
	ErrLegacySearchUsersPermissionsDenied          = errors.New("legacy user permission search request denied")
	ErrInvalidLegacySearchUsersPermissionsRequest  = errors.New("invalid legacy user permission search request")
	ErrInvalidLegacySearchUsersPermissionsResponse = errors.New("invalid legacy user permission search response")
)

// SearchService preserves the legacy search snapshot separately from current-user enumeration.
// Implementations return a complete result or an error; duplicate grants remain significant.
type SearchService interface {
	LegacySearchUsersPermissions(ctx context.Context, caller types.AuthInfo, req LegacySearchUsersPermissionsRequest) (LegacySearchUsersPermissionsResponse, error)
}

type LegacySearchUsersPermissionsRequest struct {
	Namespace string
	// Caller contains trusted requester assertions, distinct from the authenticated service.
	Caller       LegacyPermissionIdentity
	UserID       int64
	Action       string
	ActionPrefix string
	Scope        string
}

type LegacySearchUsersPermissionsResponse struct {
	Permissions map[int64][]types.Permission
}

var _ SearchService = (*LegacyClient)(nil)

func (c *LegacyClient) LegacySearchUsersPermissions(ctx context.Context, caller types.AuthInfo, req LegacySearchUsersPermissionsRequest) (LegacySearchUsersPermissionsResponse, error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacySearchUsersPermissions")
	defer span.End()
	if caller == nil || caller.GetSubject() == "" {
		return LegacySearchUsersPermissionsResponse{}, authzlib.ErrMissingAuthInfo
	}
	permission := authzlib.CheckServicePermissions(caller, "authz.grafana.app", "legacyuserpermissions", "search")
	if !permission.ServiceCall || !permission.Allowed {
		return LegacySearchUsersPermissionsResponse{}, ErrLegacySearchUsersPermissionsDenied
	}
	if !types.NamespaceMatches(caller.GetNamespace(), req.Namespace) {
		return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: got %s but expected %s", authzlib.ErrNamespaceMismatch, caller.GetNamespace(), req.Namespace)
	}
	if err := validateLegacySearchRequest(req); err != nil {
		return LegacySearchUsersPermissionsResponse{}, err
	}

	var internalID *int64
	if req.Caller.InternalID != nil {
		id := *req.Caller.InternalID
		internalID = &id
	}
	// Cancel the stream when malformed results are rejected before EOF.
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stream, err := c.clientV1.LegacySearchUsersPermissions(ctx, &authzv1.LegacySearchUsersPermissionsRequest{
		Namespace: req.Namespace,
		Caller: &authzv1.LegacyPermissionIdentity{
			Type: string(req.Caller.Type), Uid: req.Caller.UID, InternalId: internalID,
			HasUniqueId: req.Caller.HasUniqueID, OrgRole: req.Caller.OrgRole, IsGrafanaAdmin: req.Caller.IsGrafanaAdmin,
			TeamIds: slices.Clone(req.Caller.TeamIDs), Groups: slices.Clone(req.Caller.Groups),
			CacheKey: cloneLegacyString(req.Caller.CacheKey), RequesterNamespace: cloneLegacyString(req.Caller.RequesterNamespace),
		},
		UserId: req.UserID, Action: req.Action, ActionPrefix: req.ActionPrefix, Scope: req.Scope,
	})
	if err != nil {
		span.RecordError(err)
		return LegacySearchUsersPermissionsResponse{}, err
	}
	if stream == nil {
		return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: nil stream", ErrInvalidLegacySearchUsersPermissionsResponse)
	}
	result := LegacySearchUsersPermissionsResponse{Permissions: make(map[int64][]types.Permission)}
	for {
		chunk, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return result, nil
		}
		if err != nil {
			span.RecordError(err)
			return LegacySearchUsersPermissionsResponse{}, err
		}
		if chunk == nil || chunk.UserId <= 0 {
			return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: positive user ID required", ErrInvalidLegacySearchUsersPermissionsResponse)
		}
		if req.UserID > 0 && chunk.UserId != req.UserID {
			return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: unexpected target user", ErrInvalidLegacySearchUsersPermissionsResponse)
		}
		if _, ok := result.Permissions[chunk.UserId]; !ok {
			result.Permissions[chunk.UserId] = []types.Permission{}
		}
		for _, permission := range chunk.Permissions {
			if permission == nil {
				return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: nil permission", ErrInvalidLegacySearchUsersPermissionsResponse)
			}
			result.Permissions[chunk.UserId] = append(result.Permissions[chunk.UserId], types.Permission{Action: permission.Action, Scope: permission.Scope})
		}
	}
}

func validateLegacySearchRequest(req LegacySearchUsersPermissionsRequest) error {
	if err := validateLegacyPermissionNamespace(req.Namespace); err != nil {
		return fmt.Errorf("%w: concrete tenant namespace required", ErrInvalidLegacySearchUsersPermissionsRequest)
	}
	if !types.IsIdentityType(req.Caller.Type, types.TypeUser, types.TypeServiceAccount) || req.Caller.UID == "" {
		return fmt.Errorf("%w: user or service account caller required", ErrInvalidLegacySearchUsersPermissionsRequest)
	}
	if original := req.Caller.RequesterNamespace; original != nil && *original != "" && *original != req.Namespace {
		return fmt.Errorf("%w: requester namespace does not match tenant scope", ErrInvalidLegacySearchUsersPermissionsRequest)
	}
	if req.Action != "" && req.ActionPrefix != "" {
		return fmt.Errorf("%w: action and action prefix are mutually exclusive", ErrInvalidLegacySearchUsersPermissionsRequest)
	}
	if req.UserID <= 0 && req.Action == "" && req.ActionPrefix == "" {
		return fmt.Errorf("%w: an action filter or target is required", ErrInvalidLegacySearchUsersPermissionsRequest)
	}
	return nil
}
