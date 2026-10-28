package api

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPI_AnnotationNotFoundAfterDeletion(t *testing.T) {
	for _, mode := range []string{"local warm cache", "local cold cache", "legacy RPC"} {
		for _, scope := range []string{
			accesscontrol.ScopeAnnotationsTypeOrganization,
			dashboards.ScopeDashboardsProvider.GetResourceScopeUID("dashboard"),
			folder.ScopeFoldersProvider.GetResourceScopeUID("parent"),
		} {
			t.Run(mode+"/"+scope, func(t *testing.T) {
				dashboardUID := "dashboard"
				if scope == accesscontrol.ScopeAnnotationsTypeOrganization {
					dashboardUID = ""
				}
				items := []*annotations.ItemDTO{{ID: 123, DashboardUID: &dashboardUID}}
				repo := &annotations.FakeAnnotationsRepo{}
				repo.On("Find", mock.Anything, mock.Anything).Return(func(_ context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
					assert.Equal(t, int64(1), query.OrgID)
					assert.Equal(t, int64(123), query.AnnotationID)
					return items, nil
				})
				repo.On("Delete", mock.Anything, &annotations.DeleteParams{OrgID: 1, ID: 123}).Run(func(mock.Arguments) {
					items = nil
				}).Return(nil).Once()
				permissions := []accesscontrol.Permission{
					{Action: accesscontrol.ActionAnnotationsRead, Scope: scope},
					{Action: accesscontrol.ActionAnnotationsDelete, Scope: scope},
				}
				server, ac := annotationScopeTestServer(t, repo, permissions, mode == "legacy RPC")
				request := func(method string) int {
					caller := authedUserWithPermissions(1, 1, permissions)
					caller.UserUID = "u-1"
					res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewRequest(method, "/api/annotations/123", nil), caller))
					require.NoError(t, err)
					require.NoError(t, res.Body.Close())
					return res.StatusCode
				}
				require.Equal(t, http.StatusOK, request(http.MethodGet))
				require.Equal(t, http.StatusOK, request(http.MethodDelete))
				if mode == "local cold cache" {
					ac.InvalidateResolverCache(1, "annotations:id:123")
				}
				require.Equal(t, http.StatusNotFound, request(http.MethodGet))
				repo.AssertExpectations(t)
			})
		}
	}
}

func TestAPI_AnnotationScopeResolutionErrors(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		for _, tc := range []struct {
			name        string
			method      string
			dashboard   string
			lookupErr   error
			permissions []accesscontrol.Permission
			status      int
		}{
			{
				name:        "missing annotation",
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				status:      http.StatusNotFound,
			},
			{
				name:        "missing annotation on update",
				method:      http.MethodPut,
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				status:      http.StatusNotFound,
			},
			{
				name:        "missing annotation on patch",
				method:      http.MethodPatch,
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				status:      http.StatusNotFound,
			},
			{
				name:        "missing annotation on delete",
				method:      http.MethodDelete,
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				status:      http.StatusNotFound,
			},
			{
				name:        "lookup failure is not absence",
				lookupErr:   errors.New("private database failure"),
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				status:      http.StatusForbidden,
			},
			{
				name:        "existing annotation outside granted scope",
				dashboard:   "dashboard",
				permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
				status:      http.StatusForbidden,
			},
			{
				name:   "no permissions denies without resolving",
				status: http.StatusForbidden,
			},
		} {
			mode := "local/"
			if legacy {
				mode = "legacy RPC/"
			}
			t.Run(mode+tc.name, func(t *testing.T) {
				if tc.method == "" {
					tc.method = http.MethodGet
				}
				repo := &annotations.FakeAnnotationsRepo{}
				if len(tc.permissions) > 0 {
					var items []*annotations.ItemDTO
					if tc.dashboard != "" {
						items = []*annotations.ItemDTO{{ID: 123, DashboardUID: &tc.dashboard}}
					}
					repo.On("Find", mock.Anything, mock.MatchedBy(func(query *annotations.ItemQuery) bool {
						return query.OrgID == 1 && query.AnnotationID == 123
					})).Return(items, tc.lookupErr).Once()
				}
				server, _ := annotationScopeTestServer(t, repo, tc.permissions, legacy)
				caller := authedUserWithPermissions(1, 1, tc.permissions)
				caller.UserUID = "u-1"
				res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewRequest(tc.method, "/api/annotations/123", nil), caller))
				require.NoError(t, err)
				body, err := io.ReadAll(res.Body)
				require.NoError(t, err)
				require.NoError(t, res.Body.Close())
				require.Equal(t, tc.status, res.StatusCode, string(body))
				if tc.status == http.StatusNotFound {
					require.JSONEq(t, `{"title":"Not found","message":"Resource not found"}`, string(body))
				}
				require.NotContains(t, string(body), "private database failure")
				require.NotContains(t, string(body), "could not resolve")
				repo.AssertExpectations(t)
			})
		}
	}
}

func annotationScopeTestServer(t *testing.T, repo annotations.Repository, permissions []accesscontrol.Permission, legacy bool) (*webtest.Server, *acimpl.AccessControl) {
	t.Helper()
	ac := acimpl.ProvideAccessControlTest()
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.annotationsRepo = repo
		dashService := &dashboards.FakeDashboardService{}
		dashService.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{UID: "dashboard", OrgID: 1}).Return(&dashboards.Dashboard{UID: "dashboard", FolderUID: "parent"}, nil)
		ac.RegisterScopeAttributeResolver(AnnotationTypeScopeResolver(repo, hs.Features, dashService, &foldertest.FakeService{}))
		hs.AccessControl = ac
		if legacy {
			hs.AccessControl = annotationLegacyAccessControl(t, ac, permissions)
		}
	})
	return server, ac
}

// Exercise the complete RPC path before the production feature toggle is wired.
func annotationLegacyAccessControl(t *testing.T, ac *acimpl.AccessControl, permissions []accesscontrol.Permission) accesscontrol.AccessControl {
	t.Helper()
	service := rbac.NewTestService("u-1", permissions, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	authInfo := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "service-account:test"},
		Rest:   authn.AccessTokenClaims{Namespace: types.OrgNamespaceFormatter(1)},
	})
	listener := bufconn.Listen(1024 * 1024)
	server := grpc.NewServer(grpc.UnaryInterceptor(func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		return handler(types.WithAuthInfo(ctx, authInfo), req)
	}))
	authzextv1.RegisterLegacyAuthzServiceServer(server, service)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	t.Cleanup(func() { _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///annotation-legacy-check",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return &annotationLegacyEvaluator{AccessControl: ac, client: legacyclient.NewLegacyClient(conn)}
}

type annotationLegacyEvaluator struct {
	accesscontrol.AccessControl
	client legacyclient.LegacyAccessControl
}

func (a *annotationLegacyEvaluator) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return a.client.LegacyCheck(ctx, legacyclient.LegacyCheckRequest{
		Namespace: types.OrgNamespaceFormatter(user.GetOrgID()),
		Subject:   user.GetUID(),
		Evaluator: evaluator,
	})
}
