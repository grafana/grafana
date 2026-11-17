package legacyclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"

	authzlib "github.com/grafana/authlib/authz"

	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

	"github.com/grafana/authlib/types"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var (
	ErrLegacyUserPermissionsDenied          = errors.New("legacy user permissions request denied")
	ErrInvalidLegacyUserPermissionsRequest  = errors.New("invalid legacy user permissions request")
	ErrInvalidLegacyUserPermissionsResponse = errors.New("invalid legacy user permissions response")
)

var _ Service = (*LegacyClient)(nil)

// LegacyClient implements only legacy Access Control compatibility operations.
// It is independent of authlib's Check/List client and has no client-side permission cache.
type LegacyClient struct {
	clientV1 authzv1.LegacyAuthzServiceClient
	tracer   trace.Tracer
}

type LegacyClientOption func(*LegacyClient)

func WithLegacyTracerClientOption(tracer trace.Tracer) LegacyClientOption {
	return func(c *LegacyClient) { c.tracer = tracer }
}

// LegacyCheck uses the RBAC connection. LegacyGetUserPermissions requires the
// dedicated embedded service; the RBAC server does not implement enumeration.
func NewLegacyClient(cc grpc.ClientConnInterface, opts ...LegacyClientOption) *LegacyClient {
	client := &LegacyClient{clientV1: authzv1.NewLegacyAuthzServiceClient(cc), tracer: noop.Tracer{}}
	for _, opt := range opts {
		opt(client)
	}
	return client
}

// LegacyGetUserPermissions implements the embedded-only compatibility contract.
// It deliberately bypasses the client cache: cache ownership and invalidation
// belong to the embedded loader. The caller is a service, not the target user.
// Client checks do not replace server-side authentication and scope validation.
func (c *LegacyClient) LegacyGetUserPermissions(ctx context.Context, caller types.AuthInfo, req LegacyGetUserPermissionsRequest) (LegacyGetUserPermissionsResponse, error) {
	response, err := c.LegacyGetUserPermissionsChunks(ctx, caller, req)
	if err != nil {
		return LegacyGetUserPermissionsResponse{}, err
	}
	return response.Flatten(), nil
}

func (c *LegacyClient) LegacyGetUserPermissionsChunks(ctx context.Context, caller types.AuthInfo, req LegacyGetUserPermissionsRequest) (LegacyGetUserPermissionsChunksResponse, error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacyGetUserPermissions")
	defer span.End()
	if caller == nil || caller.GetSubject() == "" {
		return LegacyGetUserPermissionsChunksResponse{}, authzlib.ErrMissingAuthInfo
	}
	permission := authzlib.CheckServicePermissions(caller, "authz.grafana.app", "legacyuserpermissions", "get")
	if !permission.ServiceCall || !permission.Allowed {
		return LegacyGetUserPermissionsChunksResponse{}, ErrLegacyUserPermissionsDenied
	}
	if req.GlobalOrg && req.NoOrgMembership {
		return LegacyGetUserPermissionsChunksResponse{}, fmt.Errorf("%w: global org and no org membership are mutually exclusive", ErrInvalidLegacyUserPermissionsRequest)
	}
	if !types.NamespaceMatches(caller.GetNamespace(), req.Namespace) {
		return LegacyGetUserPermissionsChunksResponse{}, fmt.Errorf("%w: got %s but expected %s", authzlib.ErrNamespaceMismatch, caller.GetNamespace(), req.Namespace)
	}
	if err := validateLegacyPermissionNamespace(req.Namespace); err != nil {
		return LegacyGetUserPermissionsChunksResponse{}, err
	}

	var internalID *int64
	if req.Identity.InternalID != nil {
		id := *req.Identity.InternalID
		internalID = &id
	}
	// Cancel even when rejecting a malformed stream before EOF.
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	//nolint:staticcheck // This adapter intentionally calls the deprecated embedded compatibility RPC.
	stream, err := c.clientV1.LegacyGetUserPermissions(ctx, &authzv1.LegacyGetUserPermissionsRequest{
		Namespace:       req.Namespace,
		GlobalOrg:       req.GlobalOrg,
		NoOrgMembership: req.NoOrgMembership,
		Identity: &authzv1.LegacyPermissionIdentity{
			Type: string(req.Identity.Type), Uid: req.Identity.UID, InternalId: internalID,
			HasUniqueId: req.Identity.HasUniqueID, OrgRole: req.Identity.OrgRole, IsGrafanaAdmin: req.Identity.IsGrafanaAdmin,
			TeamIds: slices.Clone(req.Identity.TeamIDs), Groups: slices.Clone(req.Identity.Groups),
			CacheKey: cloneLegacyString(req.Identity.CacheKey), RequesterNamespace: cloneLegacyString(req.Identity.RequesterNamespace),
		},
		ReloadCache: req.ReloadCache, SkipZanzanaCache: req.SkipZanzanaCache,
	})
	if err != nil {
		span.RecordError(err)
		return LegacyGetUserPermissionsChunksResponse{}, err
	}
	// Buffer compact action/scope chunks instead of repeatedly growing the complete result.
	// Errors still discard the entire snapshot, and protobuf messages can be released after each receive.
	var chunks [][]types.Permission
	for {
		chunk, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return LegacyGetUserPermissionsChunksResponse{Chunks: chunks}, nil
		}
		if err != nil {
			span.RecordError(err)
			return LegacyGetUserPermissionsChunksResponse{}, err
		}
		if chunk == nil {
			return LegacyGetUserPermissionsChunksResponse{}, fmt.Errorf("%w: nil chunk", ErrInvalidLegacyUserPermissionsResponse)
		}
		if len(chunk.Permissions) == 0 {
			continue
		}
		permissions := make([]types.Permission, len(chunk.Permissions))
		for i, permission := range chunk.Permissions {
			if permission == nil {
				return LegacyGetUserPermissionsChunksResponse{}, fmt.Errorf("%w: nil permission", ErrInvalidLegacyUserPermissionsResponse)
			}
			permissions[i] = types.Permission{Action: permission.Action, Scope: permission.Scope}
		}
		chunks = append(chunks, permissions)
	}
}

func cloneLegacyString(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func validateLegacyPermissionNamespace(namespace string) error {
	ns, err := types.ParseNamespace(namespace)
	if err != nil || ns.OrgID < 1 {
		return fmt.Errorf("%w: concrete tenant namespace required", ErrInvalidLegacyUserPermissionsRequest)
	}
	return nil
}
