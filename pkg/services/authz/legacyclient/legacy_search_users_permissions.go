package legacyclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var ErrInvalidLegacySearchUsersPermissionsResponse = errors.New("invalid legacy user permission search response")

type LegacySearchUsersPermissionsRequest struct {
	Namespace string
	Options   accesscontrol.SearchOptions
	Requester LegacySearchRequester
}

// LegacySearchRequester carries trusted assertions from the authenticated in-process caller.
type LegacySearchRequester struct {
	Identity             LegacyPermissionIdentity
	OrgID                int64
	EffectivePermissions map[string][]string
	GlobalPermissions    map[string][]string
	ExternalGroups       []string
	HasDirectoryContext  bool
	IAMIDToken           string `json:"-"`
	IAMAccessToken       string `json:"-"`
	Username             string
	Name                 string
}

type LegacySearchUsersPermissionsResponse struct {
	Permissions map[int64][]accesscontrol.Permission
}

func (c *LegacyClient) LegacySearchUsersPermissions(ctx context.Context, caller types.AuthInfo, req LegacySearchUsersPermissionsRequest) (_ LegacySearchUsersPermissionsResponse, err error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacySearchUsersPermissions")
	defer func() {
		if err != nil {
			_ = tracing.Error(span, err)
		}
		span.End()
	}()

	if caller == nil || caller.GetSubject() == "" {
		return LegacySearchUsersPermissionsResponse{}, authzlib.ErrMissingAuthInfo
	}
	permission := authzlib.CheckServicePermissions(caller, "authz.grafana.app", "legacyuserpermissions", "search")
	if !permission.ServiceCall || !permission.Allowed {
		return LegacySearchUsersPermissionsResponse{}, status.Error(codes.PermissionDenied, "legacy user permission search request denied")
	}
	if !types.NamespaceMatches(caller.GetNamespace(), req.Namespace) {
		return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: got %s but expected %s", authzlib.ErrNamespaceMismatch, caller.GetNamespace(), req.Namespace)
	}

	// Cancel the stream when malformed results are rejected before EOF.
	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	//nolint:staticcheck // This adapter intentionally calls the deprecated embedded compatibility RPC.
	stream, err := c.clientV1.LegacySearchUsersPermissions(streamCtx, &authzv1.LegacySearchUsersPermissionsRequest{
		Namespace:    req.Namespace,
		UserId:       req.Options.UserID,
		Action:       req.Options.Action,
		ActionPrefix: req.Options.ActionPrefix,
		Scope:        req.Options.Scope,
		ActionSets:   req.Options.ActionSets,
		RolePrefixes: req.Options.RolePrefixes,
		Requester:    searchRequesterProto(req.Requester),
	})
	if err != nil {
		return LegacySearchUsersPermissionsResponse{}, err
	}
	if stream == nil {
		return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: nil stream", ErrInvalidLegacySearchUsersPermissionsResponse)
	}

	result := LegacySearchUsersPermissionsResponse{Permissions: make(map[int64][]accesscontrol.Permission)}
	for {
		row, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return result, nil
		}
		if err != nil {
			return LegacySearchUsersPermissionsResponse{}, err
		}
		if row == nil {
			return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: nil row", ErrInvalidLegacySearchUsersPermissionsResponse)
		}
		if req.Options.UserID > 0 && row.UserId != req.Options.UserID {
			return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: unexpected target user", ErrInvalidLegacySearchUsersPermissionsResponse)
		}
		permissions := result.Permissions[row.UserId]
		if permissions == nil && !row.NilPermissions {
			permissions = make([]accesscontrol.Permission, 0, len(row.Permissions))
		}
		for _, grant := range row.Permissions {
			if grant == nil {
				return LegacySearchUsersPermissionsResponse{}, fmt.Errorf("%w: nil permission", ErrInvalidLegacySearchUsersPermissionsResponse)
			}
			permission := accesscontrol.Permission{
				ID: grant.Id, RoleID: grant.RoleId, Action: grant.Action, Scope: grant.Scope,
				Kind: grant.Kind, Attribute: grant.Attribute, Identifier: grant.Identifier,
				DatasourceType: grant.DatasourceType,
			}
			if grant.Created != nil {
				permission.Created = grant.Created.AsTime()
			}
			if grant.Updated != nil {
				permission.Updated = grant.Updated.AsTime()
			}
			permissions = append(permissions, permission)
		}
		result.Permissions[row.UserId] = permissions
	}
}

func searchRequesterProto(r LegacySearchRequester) *authzv1.LegacySearchRequester {
	identity := r.Identity
	return &authzv1.LegacySearchRequester{
		Identity: &authzv1.LegacyPermissionIdentity{
			Type: string(identity.Type), Uid: identity.UID, InternalId: identity.InternalID,
			HasUniqueId: identity.HasUniqueID, OrgRole: identity.OrgRole, IsGrafanaAdmin: identity.IsGrafanaAdmin,
			TeamIds: slices.Clone(identity.TeamIDs), Groups: slices.Clone(identity.Groups),
			CacheKey: cloneLegacyString(identity.CacheKey), RequesterNamespace: cloneLegacyString(identity.RequesterNamespace),
		},
		OrgId:                r.OrgID,
		EffectivePermissions: searchPermissionsProto(r.EffectivePermissions),
		GlobalPermissions:    searchPermissionsProto(r.GlobalPermissions),
		ExternalGroups:       slices.Clone(r.ExternalGroups),
		HasDirectoryContext:  r.HasDirectoryContext,
		IamIdToken:           r.IAMIDToken,
		IamAccessToken:       r.IAMAccessToken,
		Username:             r.Username,
		Name:                 r.Name,
	}
}

func searchPermissionsProto(permissions map[string][]string) []*authzv1.LegacyUserPermission {
	var result []*authzv1.LegacyUserPermission
	for action, scopes := range permissions {
		for _, scope := range scopes {
			result = append(result, &authzv1.LegacyUserPermission{Action: action, Scope: scope})
		}
	}
	return result
}
