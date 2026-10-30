package server

import (
	"context"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/setting"
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
	if !s.cfg.AllowInsecure {
		caller, ok := types.AuthInfoFrom(ctx)
		if !ok || !authzlib.CheckServicePermissions(caller, "authz.grafana.app", "userpermissions", "get").Allowed {
			return status.Error(codes.PermissionDenied, "user permissions request denied")
		}
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
	if s.permissionScopeResolver == nil {
		return status.Error(codes.FailedPrecondition, "legacy scope resolution is not configured")
	}
	release, err := s.acquireSlot("GetUserPermissions", req.GetNamespace())
	if err != nil {
		return err
	}
	defer release()

	results, err := s.resolveUserPermissionContributions(ctx, req)
	if err != nil {
		return err
	}
	lists := make([]legacyscopes.PermissionList, 0, len(results))
	for _, result := range results {
		lists = append(lists, legacyscopes.PermissionList{Resource: result.Entry.Resource, Action: result.Entry.Action, List: result.List})
	}
	resolved, err := legacyscopes.ResolvePermissions(ctx, req.GetNamespace(), "", s.permissionScopeResolver, lists)
	if err != nil {
		return err
	}
	permissions := make([]*authzv1.UserPermission, 0, len(resolved))
	seen := make(map[[2]string]struct{})
	for _, permission := range resolved {
		key := [2]string{permission.Action, permission.Scope}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
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

type permissionRestConfigProvider func(context.Context) (*clientrest.Config, error)

func (p permissionRestConfigProvider) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return p(ctx)
}

func newPermissionScopeResolver(cfg *setting.Cfg, embedded restcfg.RestConfigProvider) legacyscopes.IDResolver {
	if embedded != nil {
		return legacyscopes.NewUIDResolver(embedded)
	}
	auth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := auth.Key("token").MustString("")
	exchangeURL := auth.Key("token_exchange_url").MustString("")
	if cfg.ZanzanaReconciler.IAMAPIServerURL == "" || token == "" || exchangeURL == "" {
		// Legacy numeric scopes require an authenticated IAM client.
		return nil
	}
	// Keep the IAM client lazy, as in the legacy resolver, to avoid a bootstrap
	// dependency on the API server and to work when Zanzana runs separately.
	return legacyscopes.NewUIDResolver(permissionRestConfigProvider(func(context.Context) (*clientrest.Config, error) {
		exchange, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
			Token:            token,
			TokenExchangeURL: exchangeURL,
		})
		if err != nil {
			return nil, err
		}
		return &clientrest.Config{
			Host:            cfg.ZanzanaReconciler.IAMAPIServerURL,
			APIPath:         "/apis",
			TLSClientConfig: clientrest.TLSClientConfig{Insecure: cfg.ZanzanaReconciler.TLSInsecure},
			WrapTransport:   clientauth.NewTokenExchangeTransportWrapper(exchange, clientauth.NewStaticAudienceProvider("iam.grafana.app"), clientauth.NewStaticNamespaceProvider(clientauth.WildcardNamespace)),
		}, nil
	}))
}
