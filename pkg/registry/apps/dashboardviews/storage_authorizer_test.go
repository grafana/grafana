package dashboardviews

import (
	"context"
	"errors"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	dashboardviewsv0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// These use real permission maps with direct grants; the folder-ancestry scope resolver is
// integration-level and not covered here.

const testDashboardUID = "dash-1"

// withTestNamespace sets the namespace the apiserver pipeline would; checkDashboardExists reads
// OrgID from it.
func withTestNamespace(ctx context.Context, orgID int64) context.Context {
	return genericapirequest.WithNamespace(ctx, claims.OrgNamespaceFormatter(orgID))
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
		require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
	})

	t.Run("denied when the grant is for a different dashboard", func(t *testing.T) {
		ctx := requesterWithDashboardRead("some-other-dash")
		err := authz.checkAccess(ctx, viewWithDashboardUID(testDashboardUID))
		require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
	})

	t.Run("denied with no requester in context", func(t *testing.T) {
		err := authz.checkAccess(context.Background(), viewWithDashboardUID(testDashboardUID))
		require.ErrorIs(t, err, storewrapper.ErrUnauthenticated)
	})

	t.Run("denied when dashboardUID is empty", func(t *testing.T) {
		ctx := requesterWithDashboardRead(testDashboardUID)
		err := authz.checkAccess(ctx, viewWithDashboardUID(""))
		require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
	})

	t.Run("rejects an unexpected object type", func(t *testing.T) {
		ctx := requesterWithDashboardRead(testDashboardUID)
		err := authz.checkAccess(ctx, &dashboardviewsv0alpha1.SavedDashboardViewList{})
		require.ErrorIs(t, err, storewrapper.ErrUnexpectedType)
	})
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
		require.ErrorIs(t, authz.BeforeUpdate(deniedCtx, viewWithDashboardUID(testDashboardUID), viewWithDashboardUID(testDashboardUID)), storewrapper.ErrUnauthorized)
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
		require.ErrorIs(t, err, storewrapper.ErrUnauthorized)
	})

	t.Run("resolves the dashboard against the request's namespace, not the requester's own org", func(t *testing.T) {
		// The requester is in org 1 but the dashboard only exists in org 7.
		svc := &dashboards.FakeDashboardService{}
		svc.On("GetDashboard", mock.Anything, mock.MatchedBy(func(q *dashboards.GetDashboardQuery) bool {
			return q.OrgID == 7
		})).Return(&dashboards.Dashboard{}, nil)
		authz := newTestAuthorizerWithDashboardService(svc)

		scope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(testDashboardUID)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgRole:        identity.RoleViewer,
			IsGrafanaAdmin: true,
			UserID:         1,
			OrgID:          1, // diverges from the namespace below on purpose
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: {scope}},
			},
		})
		ctx = withTestNamespace(ctx, 7)

		require.NoError(t, authz.BeforeCreate(ctx, viewWithDashboardUID(testDashboardUID)))
		svc.AssertExpectations(t)
	})

	t.Run("does not affect update/delete/get, which never repeat this check", func(t *testing.T) {
		svc := &dashboards.FakeDashboardService{}
		svc.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, errors.New("dashboard service unreachable"))
		authz := newTestAuthorizerWithDashboardService(svc)

		require.NoError(t, authz.BeforeUpdate(allowedCtx, viewWithDashboardUID(testDashboardUID), viewWithDashboardUID(testDashboardUID)))
		require.NoError(t, authz.BeforeDelete(allowedCtx, viewWithDashboardUID(testDashboardUID)))
		require.NoError(t, authz.AfterGet(allowedCtx, viewWithDashboardUID(testDashboardUID)))
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
