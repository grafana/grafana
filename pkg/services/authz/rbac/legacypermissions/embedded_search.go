package legacypermissions

import (
	"context"
	"errors"
	"net/http"
	"runtime/debug"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	otelcodes "go.opentelemetry.io/otel/codes"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
)

var embeddedSearchLogger = log.New("authz.legacypermissions.search")

type embeddedSearchCallKey struct{}

type embeddedSearchCall struct {
	embeddedTransactionCall
	permissions       map[int64][]accesscontrol.Permission
	err               error
	evaluationContext openfeature.EvaluationContext
	fallbackScope     *string
}

func (c *embeddedClient) LegacySearchUsersPermissions(ctx context.Context, caller types.AuthInfo, req legacyclient.LegacySearchUsersPermissionsRequest) (response legacyclient.LegacySearchUsersPermissionsResponse, err error) {
	if err := ctx.Err(); err != nil {
		return legacyclient.LegacySearchUsersPermissionsResponse{}, err
	}
	call := &embeddedSearchCall{
		embeddedTransactionCall: embeddedTransactionCall{done: make(chan struct{})},
		evaluationContext:       openfeature.TransactionContext(ctx),
		fallbackScope:           req.FallbackScope,
	}
	ctx = context.WithValue(ctx, embeddedTransactionCallKey{}, &call.embeddedTransactionCall)
	ctx = context.WithValue(ctx, embeddedSearchCallKey{}, call)
	defer func() {
		// Wait for the handler to publish its outcome even if cancellation
		// unblocks Recv first.
		call.wait()
		if call.err != nil {
			response, err = legacyclient.LegacySearchUsersPermissionsResponse{Permissions: call.permissions}, call.err
			return
		}
		if ctxErr := ctx.Err(); ctxErr != nil && status.Code(err) == status.FromContextError(ctxErr).Code() {
			err = ctxErr
		}
	}()
	return c.LegacyUserPermissionsClient.LegacySearchUsersPermissions(ctx, caller, req)
}

func (s *embeddedServer) LegacySearchUsersPermissions(req *authzv1.LegacySearchUsersPermissionsRequest, stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer) (err error) {
	ctx, span := tracer.Start(stream.Context(), "authz.legacypermissions.LegacySearchUsersPermissions")
	defer func() {
		if shadow.IsShadow(ctx) {
			if err != nil {
				span.SetStatus(otelcodes.Error, "permission search failed")
			}
			span.End()
			return
		}
		endPermissionSpan(span, err)
	}()
	if s.guard == nil || ctx.Value(embeddedCallKey{}) != s.guard {
		return status.Error(codes.PermissionDenied, "legacy search is embedded-only")
	}
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok || authInfo == nil {
		return status.Error(codes.Unauthenticated, "authentication is required")
	}
	permission := authzlib.CheckServicePermissions(authInfo, "authz.grafana.app", "legacyuserpermissions", "search")
	if !permission.ServiceCall || !permission.Allowed {
		return status.Error(codes.PermissionDenied, "legacy search request denied")
	}
	if !types.NamespaceMatches(authInfo.GetNamespace(), req.GetNamespace()) {
		return status.Error(codes.PermissionDenied, "namespace mismatch")
	}
	ns, err := types.ParseNamespace(req.GetNamespace())
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid namespace: %v", err)
	}
	if ns.OrgID < 1 {
		return status.Error(codes.InvalidArgument, "concrete namespace required")
	}
	if s.cfg.StackID != "" && ns.Value != legacyscopes.StackNamespace(s.cfg.StackID) {
		return status.Error(codes.PermissionDenied, "namespace does not match this instance")
	}
	if s.cfg.StackID == "" && ns.StackID != 0 {
		return status.Error(codes.PermissionDenied, "namespace does not match this instance")
	}
	caller, err := searchRequester(ns, req.GetRequester())
	if err != nil {
		return err
	}
	call, ok := ctx.Value(embeddedSearchCallKey{}).(*embeddedSearchCall)
	if !ok {
		return status.Error(codes.PermissionDenied, "legacy search requires an embedded call")
	}
	defer func() {
		if recover() != nil {
			if !shadow.IsShadow(ctx) {
				embeddedSearchLogger.FromContext(ctx).Error("Recovered from embedded permission search panic", "stack", string(debug.Stack()))
			}
			err = status.Error(codes.Internal, "legacy permission search failed")
			// Preserve the failure if cancellation has already unblocked the client.
			call.err = err
		}
	}()
	if s.loader == nil || s.loader.search == nil {
		return status.Error(codes.Unavailable, "embedded legacy search is not configured")
	}

	ctx = openfeature.WithTransactionContext(request.WithNamespace(ctx, ns.Value), call.evaluationContext)
	if shadow.IsShadow(ctx) {
		ctx = legacyscopes.WithSearchShadow(ctx)
	}
	ctx = withSearchDirectoryContext(ctx, caller, req.GetRequester().GetHasDirectoryContext())
	enforced := s.loader.enforcementEnabled()
	search := *s.loader.search
	fallback := !enforced && s.loader.license.Edition() != licensing.OpenSourceEdition
	if fallback {
		// Enterprise's unlicensed fallback uses an OSS service without these dependencies.
		// The caller performs the outer normalization for authoritative reads.
		// Shadow comparisons need the same normalization before streaming.
		search.scopeResolver = nil
		search.zanzana = nil
	}
	results, err := search.Search(ctx, caller, accesscontrol.SearchOptions{
		UserID: req.UserId, Action: req.Action, ActionPrefix: req.ActionPrefix, Scope: req.Scope,
		ActionSets: req.ActionSets, RolePrefixes: req.RolePrefixes,
	}, enforced)
	if err == nil && fallback && shadow.IsShadow(ctx) && call.fallbackScope != nil {
		results, err = legacyscopes.ResolveSearchScopes(ctx, caller, *call.fallbackScope, s.loader.search.scopeResolver, results)
	}
	if err != nil {
		if shadow.IsShadow(ctx) {
			// The comparison only needs failure status. Backend errors may
			// contain request details, including data from the IAM transport.
			return status.Error(codes.Internal, "legacy permission search failed")
		}
		// gRPC cancellation can win the stream race. Carry the original backend
		// result and wrapped cause through the private call outcome.
		call.permissions, call.err = results, err
		if status.Code(err) != codes.Unknown {
			return err
		}
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return status.FromContextError(err).Err()
		}
		return status.Error(codes.Internal, "legacy permission search failed")
	}

	return streamSearchResults(stream, results)
}

func streamSearchResults(stream authzv1.LegacyAuthzService_LegacySearchUsersPermissionsServer, results map[int64][]accesscontrol.Permission) error {
	for id, permissions := range results {
		if len(permissions) == 0 {
			if err := stream.Send(&authzv1.LegacySearchUsersPermissionsResponse{UserId: id, NilPermissions: permissions == nil}); err != nil {
				return err
			}
			continue
		}
		const chunkSize = 1000
		for start := 0; start < len(permissions); start += chunkSize {
			end := min(start+chunkSize, len(permissions))
			values := make([]authzv1.LegacySearchPermission, end-start)
			chunk := &authzv1.LegacySearchUsersPermissionsResponse{UserId: id, Permissions: make([]*authzv1.LegacySearchPermission, end-start)}
			for i, grant := range permissions[start:end] {
				p := &values[i]
				p.Id, p.RoleId, p.Action, p.Scope = grant.ID, grant.RoleID, grant.Action, grant.Scope
				p.Kind, p.Attribute, p.Identifier = grant.Kind, grant.Attribute, grant.Identifier
				p.DatasourceType = grant.DatasourceType
				if !grant.Created.IsZero() {
					p.Created = timestamppb.New(grant.Created)
				}
				if !grant.Updated.IsZero() {
					p.Updated = timestamppb.New(grant.Updated)
				}
				chunk.Permissions[i] = p
			}
			if err := stream.Send(chunk); err != nil {
				return err
			}
		}
	}
	return nil
}

func searchRequester(ns types.NamespaceInfo, caller *authzv1.LegacySearchRequester) (*legacyRequester, error) {
	assertion := caller.GetIdentity()
	if assertion == nil || assertion.Uid == "" {
		return nil, status.Error(codes.InvalidArgument, "caller UID is required")
	}
	kind := types.IdentityType(assertion.Type)
	if !types.IsIdentityType(kind, types.TypeUser, types.TypeServiceAccount, types.TypeAnonymous, types.TypeRenderService, types.TypeAPIKey, types.TypeAccessPolicy) {
		return nil, status.Errorf(codes.InvalidArgument, "unsupported legacy caller identity type %q", kind)
	}
	orgID := caller.GetOrgId()
	if orgID != ns.OrgID && orgID != 0 && orgID != -1 {
		return nil, status.Error(codes.PermissionDenied, "caller organization does not match tenant scope")
	}
	namespace := assertion.GetRequesterNamespace()
	sentinel := ns.StackID == 0 && orgID <= 0 && namespace == types.OrgNamespaceFormatter(orgID)
	if namespace != "" && namespace != ns.Value && !sentinel {
		return nil, status.Error(codes.PermissionDenied, "requester namespace does not match tenant scope")
	}

	permissions := map[int64]map[string][]string{
		accesscontrol.GlobalOrgID: searchPermissionMap(caller.GetGlobalPermissions()),
	}
	permissions[orgID] = searchPermissionMap(caller.GetEffectivePermissions())
	requester := &legacyRequester{
		SignedInUser: &user.SignedInUser{
			OrgID: orgID, UserID: assertion.GetInternalId(), UserUID: assertion.Uid, Namespace: namespace,
			OrgRole: types.RoleType(assertion.OrgRole), IsGrafanaAdmin: assertion.IsGrafanaAdmin,
			IsServiceAccount: kind == types.TypeServiceAccount, IsAnonymous: kind == types.TypeAnonymous,
			TeamIDs:  assertion.TeamIds, //nolint:staticcheck // Legacy numeric memberships remain distinct from group UIDs.
			TeamUIDs: assertion.Groups, ExternalGroups: caller.GetExternalGroups(),
			Permissions: permissions, IDToken: caller.GetIamIdToken(), AccessToken: caller.GetIamAccessToken(),
			Login: caller.GetUsername(), Name: caller.GetName(), FallbackType: kind,
		},
		identity: proto.CloneOf(assertion), namespace: namespace,
	}
	if kind == types.TypeAPIKey {
		requester.UserID, requester.ApiKeyID = 0, assertion.GetInternalId()
	}
	if kind == types.TypeRenderService {
		requester.AuthenticatedBy = "render"
	}
	return requester, nil
}

func searchPermissionMap(grants []*authzv1.LegacyUserPermission) map[string][]string {
	permissions := make(map[string][]string)
	for _, grant := range grants {
		permissions[grant.GetAction()] = append(permissions[grant.GetAction()], grant.GetScope())
	}
	return permissions
}

func withSearchDirectoryContext(ctx context.Context, caller *legacyRequester, hasDirectoryContext bool) context.Context {
	ctx = identity.WithOrgID(identity.WithRequester(ctx, caller), caller.GetOrgID())
	if !hasDirectoryContext {
		return ctx
	}
	// DirectRestConfig builds the in-process IAM transport from a request context.
	// Its existing routing and signing code receives the authenticated caller.
	req := (&http.Request{Method: http.MethodGet}).WithContext(ctx)
	return ctxkey.Set(ctx, &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: caller.SignedInUser})
}
