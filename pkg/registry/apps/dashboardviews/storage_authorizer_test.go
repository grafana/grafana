package dashboardviews

import (
	"context"
	"errors"
	"strings"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	dashboardviewsv0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

// These use real permission maps with direct grants; the folder-ancestry scope resolver is
// integration-level and not covered here.

const testDashboardUID = "dash-1"

// withTestNamespace sets the namespace the apiserver pipeline would; checkDashboardExists reads
// OrgID from it.
func withTestNamespace(ctx context.Context, orgID int64) context.Context {
	return genericapirequest.WithNamespace(ctx, claims.OrgNamespaceFormatter(orgID))
}

// requireDenied checks for the authorizer's 403.
func requireDenied(t *testing.T, err error) {
	t.Helper()
	require.True(t, apierrors.IsForbidden(err), "expected a 403, got %v", err)
}

func requesterWithDashboardRead(uid string) context.Context {
	scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(uid)
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: identity.RoleViewer,
		UserID:  1,
		OrgID:   1,
		Permissions: map[int64]map[string][]string{
			1: {
				dashboards.ActionDashboardsRead: {scope},
			},
		},
	})
	return withTestNamespace(ctx, 1)
}

func requesterWithNoPermissions() context.Context {
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: identity.RoleViewer,
		UserID:  1,
		OrgID:   1,
	})
	return withTestNamespace(ctx, 1)
}

// newTestAuthorizer's dashboard service always finds the dashboard, isolating permission checks.
func newTestAuthorizer() *savedViewStorageAuthorizer {
	return newTestAuthorizerWithDashboardService(fakeDashboardServiceAlwaysFound())
}

func newTestAuthorizerWithDashboardService(svc dashboards.DashboardService) *savedViewStorageAuthorizer {
	return &savedViewStorageAuthorizer{ac: acimpl.ProvideAccessControl(nil), dashboardSvc: svc}
}

func fakeDashboardServiceAlwaysFound() *dashboards.FakeDashboardService {
	svc := &dashboards.FakeDashboardService{}
	svc.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
	return svc
}

func viewWithDashboardUID(uid string) *dashboardviewsv0alpha1.SavedDashboardView {
	return &dashboardviewsv0alpha1.SavedDashboardView{
		Spec: dashboardviewsv0alpha1.SavedDashboardViewSpec{DashboardUID: uid},
	}
}

func TestCheckAccess(t *testing.T) {
	authz := newTestAuthorizer()

	t.Run("allowed with a direct dashboards:read grant on the exact dashboard", func(t *testing.T) {
		ctx := requesterWithDashboardRead(testDashboardUID)
		err := authz.checkAccess(ctx, viewWithDashboardUID(testDashboardUID))
		require.NoError(t, err)
	})

	t.Run("denied with no permissions at all", func(t *testing.T) {
		ctx := requesterWithNoPermissions()
		err := authz.checkAccess(ctx, viewWithDashboardUID(testDashboardUID))
		requireDenied(t, err)
	})

	t.Run("denied when the grant is for a different dashboard", func(t *testing.T) {
		ctx := requesterWithDashboardRead("some-other-dash")
		err := authz.checkAccess(ctx, viewWithDashboardUID(testDashboardUID))
		requireDenied(t, err)
	})

	t.Run("denied with no requester in context", func(t *testing.T) {
		err := authz.checkAccess(context.Background(), viewWithDashboardUID(testDashboardUID))
		require.ErrorIs(t, err, storewrapper.ErrUnauthenticated)
	})

	t.Run("denied when dashboardUID is empty", func(t *testing.T) {
		ctx := requesterWithDashboardRead(testDashboardUID)
		err := authz.checkAccess(ctx, viewWithDashboardUID(""))
		requireDenied(t, err)
	})

	t.Run("rejects an unexpected object type", func(t *testing.T) {
		ctx := requesterWithDashboardRead(testDashboardUID)
		err := authz.checkAccess(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{})
		require.ErrorIs(t, err, storewrapper.ErrUnexpectedType)
	})

	// Anonymous users and server admins pass the namespace authorizer for any org, but their grants
	// belong to their own org, where another dashboard may share the same UID.
	for name, requester := range map[string]*identity.StaticRequester{
		"server admin": {OrgRole: identity.RoleViewer, IsGrafanaAdmin: true, UserID: 1, OrgID: 1},
		"anonymous":    {Type: claims.TypeAnonymous, OrgRole: identity.RoleViewer, OrgID: 1},
	} {
		t.Run("denies a "+name+" acting in another org's namespace", func(t *testing.T) {
			scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(testDashboardUID)
			requester.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {scope}}}
			ctx := withTestNamespace(identity.WithRequester(context.Background(), requester), 7)

			requireDenied(t, authz.checkAccess(ctx, viewWithDashboardUID(testDashboardUID)))
			require.NoError(t, authz.checkAccess(withTestNamespace(ctx, 1), viewWithDashboardUID(testDashboardUID)))
		})
	}
}

func TestBeforeCreateUpdateDeleteAfterGet(t *testing.T) {
	authz := newTestAuthorizer()
	allowedCtx := requesterWithDashboardRead(testDashboardUID)
	deniedCtx := requesterWithNoPermissions()

	t.Run("BeforeCreate allows/denies same as checkAccess", func(t *testing.T) {
		require.NoError(t, authz.BeforeCreate(allowedCtx, viewWithDashboardUID(testDashboardUID)))
		require.Error(t, authz.BeforeCreate(deniedCtx, viewWithDashboardUID(testDashboardUID)))
	})

	t.Run("BeforeDelete allows/denies same as checkAccess", func(t *testing.T) {
		require.NoError(t, authz.BeforeDelete(allowedCtx, viewWithDashboardUID(testDashboardUID)))
		require.Error(t, authz.BeforeDelete(deniedCtx, viewWithDashboardUID(testDashboardUID)))
	})

	t.Run("AfterGet allows/denies same as checkAccess", func(t *testing.T) {
		require.NoError(t, authz.AfterGet(allowedCtx, viewWithDashboardUID(testDashboardUID)))
		require.Error(t, authz.AfterGet(deniedCtx, viewWithDashboardUID(testDashboardUID)))
	})

	t.Run("BeforeUpdate allows/denies same as checkAccess when the dashboard is unchanged", func(t *testing.T) {
		require.NoError(t, authz.BeforeUpdate(allowedCtx, viewWithDashboardUID(testDashboardUID), viewWithDashboardUID(testDashboardUID)))
		requireDenied(t, authz.BeforeUpdate(deniedCtx, viewWithDashboardUID(testDashboardUID), viewWithDashboardUID(testDashboardUID)))
	})

	t.Run("BeforeUpdate rejects moving a view to a different dashboard", func(t *testing.T) {
		// Even with a grant on both dashboards: the target UID was never existence-checked.
		bothCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgRole: identity.RoleViewer,
			UserID:  1,
			OrgID:   1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: {
					dashboards.ScopeDashboardsProvider.GetResourceScopeUID(testDashboardUID),
					dashboards.ScopeDashboardsProvider.GetResourceScopeUID("some-other-dash"),
				}},
			},
		})
		err := authz.BeforeUpdate(withTestNamespace(bothCtx, 1), viewWithDashboardUID(testDashboardUID), viewWithDashboardUID("some-other-dash"))
		require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
	})
}

func TestCheckDashboardExists(t *testing.T) {
	allowedCtx := requesterWithDashboardRead(testDashboardUID)

	t.Run("create succeeds when the dashboard resolves", func(t *testing.T) {
		authz := newTestAuthorizer() // always-found fake
		require.NoError(t, authz.BeforeCreate(allowedCtx, viewWithDashboardUID(testDashboardUID)))
	})

	t.Run("create is denied when a caller with a wildcard grant names a nonexistent dashboard", func(t *testing.T) {
		svc := &dashboards.FakeDashboardService{}
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, dashboards.ErrDashboardNotFound)
		authz := newTestAuthorizerWithDashboardService(svc)

		err := authz.BeforeCreate(allowedCtx, viewWithDashboardUID(testDashboardUID))
		requireDenied(t, err)
	})

	t.Run("looks the dashboard up as a service identity, not the caller", func(t *testing.T) {
		svc := &dashboards.FakeDashboardService{}
		svc.On("GetDashboard", mock.MatchedBy(identity.IsServiceIdentity), mock.Anything).Return(&dashboards.Dashboard{}, nil)
		authz := newTestAuthorizerWithDashboardService(svc)

		require.NoError(t, authz.BeforeCreate(allowedCtx, viewWithDashboardUID(testDashboardUID)))
		svc.AssertExpectations(t)
	})

	t.Run("surfaces dashboard service failures as internal errors, not denials", func(t *testing.T) {
		svc := &dashboards.FakeDashboardService{}
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, errors.New("dashboard service unreachable"))
		authz := newTestAuthorizerWithDashboardService(svc)

		err := authz.BeforeCreate(allowedCtx, viewWithDashboardUID(testDashboardUID))
		require.True(t, apierrors.IsInternalError(err), "got %v", err)
	})

	t.Run("update and delete don't look the dashboard up, so orphans can still be cleaned up", func(t *testing.T) {
		svc := &dashboards.FakeDashboardService{}
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, errors.New("dashboard service unreachable"))
		authz := newTestAuthorizerWithDashboardService(svc)

		require.NoError(t, authz.BeforeUpdate(allowedCtx, viewWithDashboardUID(testDashboardUID), viewWithDashboardUID(testDashboardUID)))
		require.NoError(t, authz.BeforeDelete(allowedCtx, viewWithDashboardUID(testDashboardUID)))
		svc.AssertNotCalled(t, "GetDashboard", mock.Anything, mock.Anything)
	})
}

func TestFilterList(t *testing.T) {
	authz := newTestAuthorizer()
	ctx := requesterWithDashboardRead(testDashboardUID)

	list := &dashboardviewsv0alpha1.SavedDashboardViewList{
		Items: []dashboardviewsv0alpha1.SavedDashboardView{
			*viewWithDashboardUID(testDashboardUID),
			*viewWithDashboardUID("some-other-dash"),
			*viewWithDashboardUID(testDashboardUID),
		},
	}

	result, err := authz.FilterList(ctx, list)
	require.NoError(t, err)

	filtered, ok := result.(*dashboardviewsv0alpha1.SavedDashboardViewList)
	require.True(t, ok)
	assert.Len(t, filtered.Items, 2, "only the two views on the accessible dashboard should survive filtering")
	for _, item := range filtered.Items {
		assert.Equal(t, testDashboardUID, item.Spec.DashboardUID)
	}

	t.Run("fails instead of returning an empty list when unauthenticated", func(t *testing.T) {
		_, err := authz.FilterList(context.Background(), &dashboardviewsv0alpha1.SavedDashboardViewList{
			Items: []dashboardviewsv0alpha1.SavedDashboardView{*viewWithDashboardUID(testDashboardUID)},
		})
		require.ErrorIs(t, err, storewrapper.ErrUnauthenticated)
	})

	t.Run("fails instead of returning an empty list when evaluation errors", func(t *testing.T) {
		failing := &savedViewStorageAuthorizer{ac: actest.FakeAccessControl{ExpectedErr: errors.New("evaluator unavailable")}}
		_, err := failing.FilterList(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{
			Items: []dashboardviewsv0alpha1.SavedDashboardView{*viewWithDashboardUID(testDashboardUID)},
		})
		require.True(t, apierrors.IsInternalError(err), "expected InternalError, got %v", err)
	})
}

func TestWatchFilterDeniesByDefault(t *testing.T) {
	authz := newTestAuthorizer()
	filter, err := authz.WatchFilter(context.Background())
	require.NoError(t, err)
	assert.Nil(t, filter, "WatchFilter must return the deny sentinel (nil) since Watch has no use case yet")
}

// A view whose dashboard was deleted makes the dashboard UID scope resolver fail.
func TestOrphanedViews(t *testing.T) {
	svc := &dashboards.FakeDashboardService{}
	svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, dashboards.ErrDashboardNotFound)
	ac := acimpl.ProvideAccessControl(nil)
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(svc, foldertest.NewFakeService()))
	authz := &savedViewStorageAuthorizer{ac: ac, dashboardSvc: svc}

	// A folder-level grant only matches after scope resolution, which is what fails here.
	ctx := withTestNamespace(identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: identity.RoleViewer,
		UserID:  1,
		OrgID:   1,
		Permissions: map[int64]map[string][]string{
			1: {dashboards.ActionDashboardsRead: {folder.ScopeFoldersProvider.GetResourceScopeUID("folder-1")}},
		},
	}), 1)

	t.Run("get, delete and create are denied, not internal errors", func(t *testing.T) {
		requireDenied(t, authz.AfterGet(ctx, viewWithDashboardUID("deleted-dash")))
		requireDenied(t, authz.BeforeDelete(ctx, viewWithDashboardUID("deleted-dash")))
		requireDenied(t, authz.BeforeCreate(ctx, viewWithDashboardUID("deleted-dash")))
	})

	t.Run("list drops the orphan instead of failing", func(t *testing.T) {
		result, err := authz.FilterList(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{
			Items: []dashboardviewsv0alpha1.SavedDashboardView{*viewWithDashboardUID("deleted-dash")},
		})
		require.NoError(t, err)
		filtered, ok := result.(*dashboardviewsv0alpha1.SavedDashboardViewList)
		require.True(t, ok)
		assert.Empty(t, filtered.Items)
	})
}

func TestAnonymousViewers(t *testing.T) {
	authz := newTestAuthorizer()
	scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(testDashboardUID)
	ctx := withTestNamespace(identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:        claims.TypeAnonymous,
		OrgRole:     identity.RoleViewer,
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {scope}}},
	}), 1)
	view := viewWithDashboardUID(testDashboardUID)

	t.Run("can read shared views", func(t *testing.T) {
		require.NoError(t, authz.AfterGet(ctx, view))
		result, err := authz.FilterList(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{
			Items: []dashboardviewsv0alpha1.SavedDashboardView{*view},
		})
		require.NoError(t, err)
		filtered, ok := result.(*dashboardviewsv0alpha1.SavedDashboardViewList)
		require.True(t, ok)
		assert.Len(t, filtered.Items, 1)
	})

	t.Run("cannot create, update or delete them", func(t *testing.T) {
		requireDenied(t, authz.BeforeCreate(ctx, view))
		requireDenied(t, authz.BeforeUpdate(ctx, view, view))
		requireDenied(t, authz.BeforeDelete(ctx, view))
	})
}

func wildcardReader() context.Context {
	return withTestNamespace(identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: identity.RoleAdmin,
		UserID:  1,
		OrgID:   1,
		Permissions: map[int64]map[string][]string{
			1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID("*")}},
		},
	}), 1)
}

// A wildcard grant passes checkAccess without resolving the scope, so only the existence check
// hides views of a deleted dashboard from it.
func TestOrphanedViewsForWildcardGrants(t *testing.T) {
	svc := &dashboards.FakeDashboardService{}
	svc.On("GetDashboard", mock.Anything, mock.MatchedBy(func(q *dashboards.GetDashboardQuery) bool {
		return q.UID == "deleted-dash"
	})).Return(nil, dashboards.ErrDashboardNotFound)
	svc.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil)
	authz := newTestAuthorizerWithDashboardService(svc)
	ctx := wildcardReader()

	t.Run("get is denied", func(t *testing.T) {
		requireDenied(t, authz.AfterGet(ctx, viewWithDashboardUID("deleted-dash")))
		require.NoError(t, authz.AfterGet(ctx, viewWithDashboardUID(testDashboardUID)))
	})

	t.Run("list drops orphans and looks each dashboard up once", func(t *testing.T) {
		svc.Calls = nil
		result, err := authz.FilterList(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{
			Items: []dashboardviewsv0alpha1.SavedDashboardView{
				*viewWithDashboardUID(testDashboardUID),
				*viewWithDashboardUID("deleted-dash"),
				*viewWithDashboardUID(testDashboardUID),
				*viewWithDashboardUID("deleted-dash"),
			},
		})
		require.NoError(t, err)
		filtered, ok := result.(*dashboardviewsv0alpha1.SavedDashboardViewList)
		require.True(t, ok)
		require.Len(t, filtered.Items, 2)
		for _, item := range filtered.Items {
			assert.Equal(t, testDashboardUID, item.Spec.DashboardUID)
		}
		svc.AssertNumberOfCalls(t, "GetDashboard", 2)
	})

	t.Run("delete still works, so orphans can be cleaned up", func(t *testing.T) {
		require.NoError(t, authz.BeforeDelete(ctx, viewWithDashboardUID("deleted-dash")))
	})
}

func TestAccessCheckErrorsDoNotLeakDetails(t *testing.T) {
	ac := acimpl.ProvideAccessControl(nil)
	ac.RegisterScopeAttributeResolver(dashboards.ScopeDashboardsProvider.GetResourceScopeUID(""),
		accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) {
			return nil, errors.New("connection to db-internal-7 refused")
		}))
	authz := &savedViewStorageAuthorizer{ac: ac, dashboardSvc: fakeDashboardServiceAlwaysFound()}
	ctx := withTestNamespace(identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: identity.RoleViewer,
		UserID:  1,
		OrgID:   1,
		Permissions: map[int64]map[string][]string{
			1: {dashboards.ActionDashboardsRead: {folder.ScopeFoldersProvider.GetResourceScopeUID("folder-1")}},
		},
	}), 1)

	for name, err := range map[string]error{
		"get": authz.AfterGet(ctx, viewWithDashboardUID(testDashboardUID)),
		"list": func() error {
			_, err := authz.FilterList(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{
				Items: []dashboardviewsv0alpha1.SavedDashboardView{*viewWithDashboardUID(testDashboardUID)},
			})
			return err
		}(),
	} {
		t.Run(name, func(t *testing.T) {
			require.True(t, apierrors.IsInternalError(err), "got %v", err)
			assert.NotContains(t, err.Error(), "db-internal-7")
		})
	}
}

func TestReservedAnnotations(t *testing.T) {
	authz := newTestAuthorizer()
	ctx := requesterWithDashboardRead(testDashboardUID)
	managed := viewWithDashboardUID(testDashboardUID)
	managed.SetAnnotations(map[string]string{utils.AnnoKeyManagerKind: "repo"})

	require.True(t, apierrors.IsBadRequest(authz.BeforeCreate(ctx, managed)))
	require.True(t, apierrors.IsBadRequest(authz.BeforeUpdate(ctx, viewWithDashboardUID(testDashboardUID), managed)))
	require.NoError(t, authz.BeforeCreate(ctx, viewWithDashboardUID(testDashboardUID)))
}

func TestFilterListForGrafanaServiceIdentity(t *testing.T) {
	authz := newTestAuthorizer()
	ctx, _ := identity.WithServiceIdentity(withTestNamespace(context.Background(), 1), 0)
	list := &dashboardviewsv0alpha1.SavedDashboardViewList{
		Items: []dashboardviewsv0alpha1.SavedDashboardView{*viewWithDashboardUID(testDashboardUID), *viewWithDashboardUID("other")},
	}

	result, err := authz.FilterList(ctx, list)
	require.NoError(t, err)
	filtered, ok := result.(*dashboardviewsv0alpha1.SavedDashboardViewList)
	require.True(t, ok)
	assert.Len(t, filtered.Items, 2)
}

func TestMalformedDashboardUIDs(t *testing.T) {
	// The resolver would fail on these with a 500; they must be plain denials instead.
	ac := acimpl.ProvideAccessControl(nil)
	ac.RegisterScopeAttributeResolver(dashboards.ScopeDashboardsProvider.GetResourceScopeUID(""),
		accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) {
			return nil, errors.New("invalid name")
		}))
	authz := &savedViewStorageAuthorizer{ac: ac, dashboardSvc: fakeDashboardServiceAlwaysFound()}
	ctx := withTestNamespace(identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgRole: identity.RoleViewer,
		UserID:  1,
		OrgID:   1,
		Permissions: map[int64]map[string][]string{
			1: {dashboards.ActionDashboardsRead: {folder.ScopeFoldersProvider.GetResourceScopeUID("folder-1")}},
		},
	}), 1)

	for _, uid := range []string{"a/b", "..", "50%", strings.Repeat("x", maxDashboardUIDLength+1)} {
		requireDenied(t, authz.BeforeCreate(ctx, viewWithDashboardUID(uid)))
		requireDenied(t, authz.AfterGet(ctx, viewWithDashboardUID(uid)))
	}
}
