package legacypermissions

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type remoteNamespaceKey struct{}

// RemoteServer uses the host service's authenticated gRPC context.
type RemoteServer struct {
	loader  *Loader
	metrics *serverMetrics
	tracer  tracing.Tracer
}

func NewRemoteServer(loader *Loader, reg prometheus.Registerer, tracer tracing.Tracer) *RemoteServer {
	return &RemoteServer{loader: loader, metrics: newMetrics(reg, "remote"), tracer: tracer}
}

func (s *RemoteServer) LegacyGetUserPermissions(req *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) (err error) {
	started := time.Now()
	defer func() {
		result := "ok"
		if err != nil {
			result = "error"
		}
		s.metrics.observe(started, result)
	}()
	ctx := stream.Context()
	ns, err := authorizeRemoteRequest(ctx, req)
	if err != nil {
		return err
	}
	ctx = request.WithNamespace(ctx, req.Namespace)
	ctx = context.WithValue(ctx, remoteNamespaceKey{}, req.Namespace)
	orgID := ns.OrgID
	if req.GlobalOrg {
		orgID = ac.GlobalOrgID
	} else if req.NoOrgMembership {
		orgID = -1
	}
	resolutionNamespace := req.Namespace
	if original := req.Identity.RequesterNamespace; original != nil {
		resolutionNamespace = *original
	}
	identity, err := s.loadIdentity(ctx, ns, req.Identity, orgID)
	if err != nil {
		return err
	}
	identity.RequesterNamespace = &resolutionNamespace
	req = proto.Clone(req).(*authzv1.LegacyGetUserPermissionsRequest)
	req.Identity = identity
	return s.loader.streamPermissions(ctx, req, stream, resolutionNamespace, orgID)
}

func authorizeRemoteRequest(ctx context.Context, req *authzv1.LegacyGetUserPermissionsRequest) (types.NamespaceInfo, error) {
	caller, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return types.NamespaceInfo{}, status.Error(codes.Unauthenticated, "authenticated caller required")
	}
	if !authzlib.CheckServicePermissions(caller, "authz.grafana.app", "userpermissions", "get").Allowed {
		return types.NamespaceInfo{}, status.Error(codes.PermissionDenied, "user permissions request denied")
	}
	if req == nil || req.Identity == nil {
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "legacy identity is required")
	}
	ns, err := types.ParseNamespace(req.Namespace)
	if err != nil {
		return types.NamespaceInfo{}, status.Errorf(codes.InvalidArgument, "invalid namespace %q: %v", req.Namespace, err)
	}
	if ns.OrgID < 1 || req.Namespace == "" || req.Namespace == "*" {
		return types.NamespaceInfo{}, status.Errorf(codes.InvalidArgument, "concrete namespace required, got %q", req.Namespace)
	}
	if !types.NamespaceMatches(caller.GetNamespace(), req.Namespace) {
		return types.NamespaceInfo{}, status.Error(codes.PermissionDenied, "namespace does not match")
	}
	if req.GlobalOrg && req.NoOrgMembership {
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "global org and no org membership are mutually exclusive")
	}
	original := req.Identity.GetRequesterNamespace()
	sentinel := ns.StackID == 0 &&
		((req.GlobalOrg && original == types.OrgNamespaceFormatter(ac.GlobalOrgID)) ||
			(req.NoOrgMembership && original == types.OrgNamespaceFormatter(ac.NoOrgID)))
	if original != "" && original != req.Namespace && !sentinel {
		return types.NamespaceInfo{}, status.Errorf(codes.PermissionDenied,
			"requester namespace %q does not match tenant namespace %q (global_org=%t, no_org_membership=%t)",
			original, req.Namespace, req.GlobalOrg, req.NoOrgMembership)
	}
	id := req.Identity
	switch types.IdentityType(id.Type) {
	case types.TypeUser, types.TypeServiceAccount:
		if id.Uid == "" {
			return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "user identity requires UID")
		}
	case types.TypeAnonymous:
	default:
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "unsupported legacy identity type")
	}
	return ns, nil
}

func tenantCacheKey(ctx context.Context, key string) string {
	if ns, ok := ctx.Value(remoteNamespaceKey{}).(string); ok {
		return fmt.Sprintf("legacy-remote:%q:%s", ns, key)
	}
	return key
}

// remoteIdentityClaims holds the claims that can change remote enumeration results.
type remoteIdentityClaims struct {
	Namespace           string   `json:"namespace"`
	ResolutionNamespace string   `json:"resolutionNamespace"`
	OrgID               int64    `json:"orgId"`
	Type                string   `json:"type"`
	UID                 string   `json:"uid"`
	Role                string   `json:"role"`
	InternalID          int64    `json:"internalId"`
	Admin               bool     `json:"admin"`
	Unique              bool     `json:"unique"`
	Teams               []int64  `json:"teams"`
	Groups              []string `json:"groups"`
}

func remoteIdentityCacheKey(id *authzv1.LegacyPermissionIdentity, namespace string, orgID int64) (string, error) {
	// Ignore caller-selected cache keys. Include claims that can affect nested resolvers.
	data, err := json.Marshal(remoteIdentityClaims{
		Namespace:           namespace,
		ResolutionNamespace: id.GetRequesterNamespace(),
		OrgID:               orgID,
		Type:                id.Type,
		UID:                 id.Uid,
		Role:                id.OrgRole,
		InternalID:          id.GetInternalId(),
		Admin:               id.IsGrafanaAdmin,
		Unique:              id.HasUniqueId,
		Teams:               id.TeamIds,
		Groups:              id.Groups,
	})
	if err != nil {
		return "", fmt.Errorf("encode remote identity cache key: %w", err)
	}
	return fmt.Sprintf("%x", sha256.Sum256(data)), nil
}
