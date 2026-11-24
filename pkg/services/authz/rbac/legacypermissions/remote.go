package legacypermissions

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apiserver/pkg/endpoints/request"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type remoteNamespaceKey struct{}

// RemoteServer uses the host service's authenticated gRPC context.
type RemoteServer struct {
	loader  *Loader
	metrics *serverMetrics
}

func NewRemoteServer(loader *Loader, reg prometheus.Registerer) *RemoteServer {
	return &RemoteServer{loader: loader, metrics: newMetrics(reg, "remote")}
}

func (s *RemoteServer) LegacyGetUserPermissions(req *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
	started := time.Now()
	result := "error"
	defer func() { s.metrics.observe(started, result) }()
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
	if err := s.loader.streamPermissions(ctx, req, stream, req.Namespace, orgID); err != nil {
		return err
	}
	result = "ok"
	return nil
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
	if err != nil || ns.OrgID < 1 || req.Namespace == "" || req.Namespace == "*" {
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "concrete namespace required")
	}
	if !types.NamespaceMatches(caller.GetNamespace(), req.Namespace) {
		return types.NamespaceInfo{}, status.Error(codes.PermissionDenied, "namespace does not match")
	}
	if req.GlobalOrg && req.NoOrgMembership {
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "global org and no org membership are mutually exclusive")
	}
	original := req.Identity.GetRequesterNamespace()
	if original != "" && original != req.Namespace {
		return types.NamespaceInfo{}, status.Error(codes.PermissionDenied, "requester namespace does not match tenant scope")
	}
	id := req.Identity
	switch types.IdentityType(id.Type) {
	case types.TypeUser, types.TypeServiceAccount:
		if id.InternalId == nil || *id.InternalId <= 0 || id.Uid == "" {
			return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "user identity requires UID and positive internal ID")
		}
	case types.TypeAnonymous:
	default:
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "unsupported legacy identity type")
	}
	for _, team := range id.TeamIds {
		if team <= 0 {
			return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "team ID must be positive")
		}
	}
	switch types.RoleType(id.OrgRole) {
	case types.RoleNone, types.RoleViewer, types.RoleEditor, types.RoleAdmin, "":
	default:
		return types.NamespaceInfo{}, status.Error(codes.InvalidArgument, "invalid organization role")
	}
	return ns, nil
}

func tenantCacheKey(ctx context.Context, key string) string {
	if ns, ok := ctx.Value(remoteNamespaceKey{}).(string); ok {
		return fmt.Sprintf("legacy-remote:%q:%s", ns, key)
	}
	return key
}

func remoteIdentityCacheKey(id *authzv1.LegacyPermissionIdentity, namespace string, orgID int64) string {
	// Ignore caller-selected cache keys. Include claims that can affect nested resolvers.
	claims := struct {
		Namespace       string
		OrgID           int64
		Type, UID, Role string
		InternalID      int64
		Admin, Unique   bool
		Teams           []int64
		Groups          []string
	}{namespace, orgID, id.Type, id.Uid, id.OrgRole, id.GetInternalId(), id.IsGrafanaAdmin, id.HasUniqueId, id.TeamIds, id.Groups}
	data, _ := json.Marshal(claims)
	return fmt.Sprintf("%x", sha256.Sum256(data))
}
