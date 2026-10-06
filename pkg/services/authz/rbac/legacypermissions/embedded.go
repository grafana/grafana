package legacypermissions

import (
	"context"
	"fmt"
	"strconv"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type embeddedCallKey struct{}
type embeddedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s embeddedStream) Context() context.Context { return s.ctx }

type embeddedServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	loader *Loader
	cfg    *setting.Cfg
	guard  *int
}

// NewEmbeddedClient owns a private in-process channel. The legacy handler is
// deliberately never registered on a network server or the Check/List channel.
func NewEmbeddedClient(loader *Loader, cfg *setting.Cfg) types.LegacyAuthzService {
	guard := new(int)
	server := &embeddedServer{loader: loader, cfg: cfg, guard: guard}
	channel := (&inprocgrpc.Channel{}).WithServerStreamInterceptor(func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := stream.Context()
		if clientCtx := inprocgrpc.ClientContext(ctx); clientCtx != nil {
			ctx = trace.ContextWithSpanContext(ctx, trace.SpanContextFromContext(clientCtx))
		}
		ctx = context.WithValue(ctx, embeddedCallKey{}, guard)
		ctx = types.WithAuthInfo(ctx, ac.LegacyPermissionCaller("*"))
		return handler(srv, embeddedStream{ServerStream: stream, ctx: ctx})
	})
	authzv1.RegisterLegacyAuthzServiceServer(channel, server)
	return authzlib.NewLegacyClient(channel)
}

func (s *embeddedServer) LegacyGetUserPermissions(req *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
	ctx := stream.Context()
	if s.guard == nil || ctx.Value(embeddedCallKey{}) != s.guard {
		return status.Error(codes.PermissionDenied, "legacy enumeration is embedded-only")
	}
	if req == nil || req.Identity == nil {
		return status.Error(codes.InvalidArgument, "legacy identity is required")
	}
	ns, err := types.ParseNamespace(req.Namespace)
	if err != nil || ns.OrgID < 1 {
		return status.Error(codes.InvalidArgument, "concrete namespace required")
	}
	if s.cfg.StackID != "" {
		if req.Namespace != "stacks-"+s.cfg.StackID {
			return status.Error(codes.PermissionDenied, "namespace does not match this instance")
		}
	} else if ns.StackID != 0 {
		return status.Error(codes.PermissionDenied, "stack namespace is not configured")
	}
	namespace := req.Namespace
	if original := req.Identity.RequesterNamespace; original != nil {
		if *original != "" && *original != req.Namespace {
			return status.Error(codes.PermissionDenied, "requester namespace does not match tenant scope")
		}
		namespace = *original
	}
	orgID := ns.OrgID
	if req.GlobalOrg {
		orgID = ac.GlobalOrgID
	}
	requester := &legacyRequester{
		SignedInUser: &user.SignedInUser{OrgID: orgID, OrgRole: identity.RoleType(req.Identity.OrgRole), IsGrafanaAdmin: req.Identity.IsGrafanaAdmin, TeamIDs: req.Identity.TeamIds},
		identity:     req.Identity, namespace: namespace,
	}
	permissions, err := s.loader.GetUserPermissions(ctx, requester, ac.Options{ReloadCache: req.ReloadCache, SkipZanzanaCache: req.SkipZanzanaCache})
	if err != nil {
		return err
	}
	// Load successfully before streaming; clients discard all chunks on error.
	const chunkSize = 1000
	for start := 0; start < len(permissions); start += chunkSize {
		end := min(start+chunkSize, len(permissions))
		chunk := &authzv1.LegacyGetUserPermissionsResponse{Permissions: make([]*authzv1.LegacyPermission, 0, end-start)}
		for _, p := range permissions[start:end] {
			chunk.Permissions = append(chunk.Permissions, &authzv1.LegacyPermission{Action: p.Action, Scope: p.Scope})
		}
		if err := stream.Send(chunk); err != nil {
			return err
		}
	}
	return nil
}

// Override the identity methods used by enumeration instead of reconstructing
// roles, teams or admin state from database-backed identity caches.
type legacyRequester struct {
	*user.SignedInUser
	identity  *authzv1.LegacyPermissionIdentity
	namespace string
}

func (r *legacyRequester) GetIdentityType() types.IdentityType {
	return types.IdentityType(r.identity.Type)
}
func (r *legacyRequester) IsIdentityType(expected ...types.IdentityType) bool {
	return types.IsIdentityType(r.GetIdentityType(), expected...)
}
func (r *legacyRequester) GetIdentifier() string { return r.identity.Uid }
func (r *legacyRequester) GetUID() string {
	return types.NewTypeID(r.GetIdentityType(), r.identity.Uid)
}
func (r *legacyRequester) GetID() string {
	return types.NewTypeID(r.GetIdentityType(), strconv.FormatInt(r.identity.GetInternalId(), 10))
}
func (r *legacyRequester) GetInternalID() (int64, error) {
	if r.identity.InternalId == nil {
		return 0, identity.ErrIdentifierNotInitialized
	}
	return *r.identity.InternalId, nil
}
func (r *legacyRequester) HasUniqueId() bool           { return r.identity.HasUniqueId }
func (r *legacyRequester) GetNamespace() string        { return r.namespace }
func (r *legacyRequester) GetGroups() []string         { return r.identity.Groups }
func (r *legacyRequester) GetExternalGroups() []string { return r.identity.Groups }
func (r *legacyRequester) GetCacheKey() string {
	if r.identity.CacheKey != nil {
		return *r.identity.CacheKey
	}
	id := strconv.FormatInt(r.identity.GetInternalId(), 10)
	if !r.HasUniqueId() {
		id = string(r.GetOrgRole())
		if id == "" {
			id = string(identity.RoleNone)
		}
	}
	return fmt.Sprintf("%d-%s-%s", r.GetOrgID(), r.GetIdentityType(), id)
}
