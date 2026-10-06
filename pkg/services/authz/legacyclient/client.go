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

// NewLegacyClient constructs a client for a dedicated embedded legacy service.
// Do not reuse a remote Check/List connection for this service.
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
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacyGetUserPermissions")
	defer span.End()
	if caller == nil || caller.GetSubject() == "" {
		return LegacyGetUserPermissionsResponse{}, authzlib.ErrMissingAuthInfo
	}
	permission := authzlib.CheckServicePermissions(caller, "authz.grafana.app", "legacyuserpermissions", "get")
	if !permission.ServiceCall || !permission.Allowed {
		return LegacyGetUserPermissionsResponse{}, ErrLegacyUserPermissionsDenied
	}
	if !types.NamespaceMatches(caller.GetNamespace(), req.Namespace) {
		return LegacyGetUserPermissionsResponse{}, fmt.Errorf("%w: got %s but expected %s", authzlib.ErrNamespaceMismatch, caller.GetNamespace(), req.Namespace)
	}
	if err := validateLegacyPermissionNamespace(req.Namespace); err != nil {
		return LegacyGetUserPermissionsResponse{}, err
	}

	var internalID *int64
	if req.Identity.InternalID != nil {
		id := *req.Identity.InternalID
		internalID = &id
	}
	// Cancel even when rejecting a malformed stream before EOF.
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stream, err := c.clientV1.LegacyGetUserPermissions(ctx, &authzv1.LegacyGetUserPermissionsRequest{
		Namespace: req.Namespace,
		GlobalOrg: req.GlobalOrg,
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
		return LegacyGetUserPermissionsResponse{}, err
	}
	var result LegacyGetUserPermissionsResponse
	for {
		chunk, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return result, nil
		}
		if err != nil {
			span.RecordError(err)
			return LegacyGetUserPermissionsResponse{}, err
		}
		if chunk == nil {
			return LegacyGetUserPermissionsResponse{}, fmt.Errorf("%w: nil chunk", ErrInvalidLegacyUserPermissionsResponse)
		}
		for _, permission := range chunk.Permissions {
			if permission == nil {
				return LegacyGetUserPermissionsResponse{}, fmt.Errorf("%w: nil permission", ErrInvalidLegacyUserPermissionsResponse)
			}
			result.Permissions = append(result.Permissions, types.Permission{Action: permission.Action, Scope: permission.Scope})
		}
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
