package accesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org"
)

type testRoute struct {
	name string
}

func (r testRoute) GetUID() string {
	return r.name
}

func TestRouteAccess(t *testing.T) {
	defaultRoute := testRoute{name: legacy_storage.UserDefinedRoutingTreeName}
	route1 := testRoute{name: "route-1"}
	route2 := testRoute{name: "route-2"}

	allRoutes := []testRoute{defaultRoute, route1, route2}

	permissions := func(perms ...models.RoutePermission) models.RoutePermissionSet {
		set := models.NewRoutePermissionSet()
		for _, v := range models.RoutePermissions() {
			set.Set(v, false)
		}
		for _, v := range perms {
			set.Set(v, true)
		}
		return set
	}

	newEmptyUser := func(permissions ...ac.Permission) identity.Requester {
		return ac.BackgroundUser("test", orgID, org.RoleNone, permissions)
	}

	newViewUser := func(permissions ...ac.Permission) identity.Requester {
		return ac.BackgroundUser("test", orgID, org.RoleNone, append([]ac.Permission{
			{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll},
		}, permissions...))
	}

	testCases := []struct {
		name     string
		user     identity.Requester
		expected map[string]models.RoutePermissionSet
	}{
		// Legacy route-specific read (alert.notifications.routes:read) — only grants access to default route.
		{
			name: "legacy routes:read grants no elevated permissions on any route",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingRoutesRead}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		// Legacy system-wide read (alert.notifications:read) — only grants access to default route.
		{
			name: "legacy notifications:read grants no elevated permissions on any route",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingNotificationsRead}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		// Legacy write covers update and delete but ONLY for the default route.
		{
			name: "legacy routes:write with routes:read grants write+delete only on default route",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionWrite, models.RoutePermissionDelete),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			name: "legacy notifications:write with notifications:read grants write+delete only on default route",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingNotificationsRead},
				ac.Permission{Action: ac.ActionAlertingNotificationsWrite},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionWrite, models.RoutePermissionDelete),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			name: "legacy routes:write without read grants nothing",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingRoutesWrite}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			name: "global scoped reader grants no elevated permissions",
			user: newEmptyUser(ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			name: "global scoped writer grants write but no delete",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesAll}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionWrite),
				route1.name:       permissions(models.RoutePermissionWrite),
				route2.name:       permissions(models.RoutePermissionWrite),
			},
		},
		{
			name: "per-route scoped writer grants per-route write",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionWrite),
				route2.name:       permissions(),
			},
		},
		{
			name: "per-route scoped writer requires read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		// New scoped delete.
		{
			name: "global scoped deleter grants delete but no write",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesAll}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionDelete),
				route1.name:       permissions(models.RoutePermissionDelete),
				route2.name:       permissions(models.RoutePermissionDelete),
			},
		},
		{
			name: "per-route scoped deleter grants per-route delete",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionDelete),
				route2.name:       permissions(models.RoutePermissionDelete),
			},
		},
		{
			name: "per-route scoped deleter requires read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		// Admin (permissions management).
		{
			name: "route read permissions alone cannot admin",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesAll}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			name: "route write permissions alone cannot admin",
			user: newViewUser(ac.Permission{Action: ac.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesAll}),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			name: "global route read+write permissions can admin all routes",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesAll},
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesAll},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionAdmin),
				route1.name:       permissions(models.RoutePermissionAdmin),
				route2.name:       permissions(models.RoutePermissionAdmin),
			},
		},
		{
			name: "per-route read+write permissions grant per-route admin",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionAdmin),
				route2.name:       permissions(),
			},
		},
		{
			name: "per-route admin requires read",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		// Mixed: legacy + new scoped.
		{
			// Scoped write requires scoped read (enforced by extendAccessControl).
			// Legacy routes:read only covers the default route, so scoped write on route-1 without scoped read grants nothing on route-1.
			name: "legacy routes:read + scoped write without scoped read grants nothing on scoped route",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		{
			// Scoped delete also requires scoped read. Legacy routes:read only covers default.
			name: "legacy routes:read + scoped read+delete grants delete only on scoped route",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(),
				route2.name:       permissions(models.RoutePermissionDelete),
			},
		},
		{
			// Legacy routes:write grants write/delete on default. Scoped permissions + scoped read grant admin on route-1.
			name: "legacy routes:write + scoped read+admin grants full write on default + admin on scoped route",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionWrite, models.RoutePermissionDelete),
				route1.name:       permissions(models.RoutePermissionAdmin),
				route2.name:       permissions(),
			},
		},
		{
			// Scoped read + scoped write on route-1 grants write on route-1 (not on default without write).
			// Note: legacy routes:write (ActionAlertingRoutesWrite) is a different action from managed:write
			// (ActionAlertingManagedRoutesWrite) and does NOT grant write on non-default routes.
			name: "scoped read+write on route1 grants write on route1 (legacy write does not apply to non-default)",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionWrite, models.RoutePermissionDelete),
				route2.name:       permissions(),
			},
		},
		// Verify legacy actions do NOT satisfy "all" evaluators.
		{
			name: "legacy routes:read does not grant write-all or delete-all",
			user: newEmptyUser(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expected: map[string]models.RoutePermissionSet{
				// write/delete only on default, not on other managed routes
				defaultRoute.name: permissions(models.RoutePermissionWrite, models.RoutePermissionDelete),
				route1.name:       permissions(),
				route2.name:       permissions(),
			},
		},
		// Overlapping global + per-route scoped permissions.
		{
			name: "global read + per-route write grants write only on scoped route",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionWrite),
				route2.name:       permissions(),
			},
		},
		{
			name: "global read + per-route delete on route1 does not grant delete on route2",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionDelete),
				route2.name:       permissions(),
			},
		},
		{
			name: "global read + per-route write and delete on different routes",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionWrite),
				route2.name:       permissions(models.RoutePermissionDelete),
			},
		},
		{
			name: "global read + per-route admin on route1 + per-route write on route2",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesPermissionsWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(),
				route1.name:       permissions(models.RoutePermissionAdmin),
				route2.name:       permissions(models.RoutePermissionWrite),
			},
		},
		{
			name: "global write + per-route delete on route1 grants write everywhere but delete only on route1",
			user: newViewUser(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesAll},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: map[string]models.RoutePermissionSet{
				defaultRoute.name: permissions(models.RoutePermissionWrite),
				route1.name:       permissions(models.RoutePermissionWrite, models.RoutePermissionDelete),
				route2.name:       permissions(models.RoutePermissionWrite),
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			svc := NewRouteAccess[testRoute](&recordingAccessControlFake{}, fakes.NewFakeRoutePermissionsService(), false)

			actual, err := svc.Access(context.Background(), testCase.user, allRoutes...)

			assert.NoError(t, err)
			assert.Equalf(t, testCase.expected, actual, "expected: %v, actual: %v", testCase.expected, actual)
		})
	}
}

func TestRouteAccessFilterRead(t *testing.T) {
	defaultRoute := testRoute{name: legacy_storage.UserDefinedRoutingTreeName}
	route1 := testRoute{name: "route-1"}
	route2 := testRoute{name: "route-2"}

	allRoutes := []testRoute{defaultRoute, route1, route2}

	user := func(perms ...ac.Permission) identity.Requester {
		return ac.BackgroundUser("test", orgID, org.RoleNone, perms)
	}

	testCases := []struct {
		name                string
		user                identity.Requester
		includeProvisioning bool
		expected            []testRoute
	}{
		{
			name:     "legacy routes:read can read only default route",
			user:     user(ac.Permission{Action: ac.ActionAlertingRoutesRead}),
			expected: []testRoute{defaultRoute},
		},
		{
			name:     "legacy notifications:read can read only default route",
			user:     user(ac.Permission{Action: ac.ActionAlertingNotificationsRead}),
			expected: []testRoute{defaultRoute},
		},
		{
			name:     "global scoped reader can read all routes",
			user:     user(ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll}),
			expected: allRoutes,
		},
		{
			name: "per-route scoped reader can read specific routes",
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expected: []testRoute{route1, route2},
		},
		{
			name: "legacy read + scoped read gives default + scoped routes",
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expected: []testRoute{defaultRoute, route1},
		},
		{
			name:     "user without read permissions gets empty list",
			user:     user(),
			expected: nil,
		},
		// Provisioning permissions — default route only.
		{
			name:                "provisioning:read can read only default route",
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			includeProvisioning: true,
			expected:            []testRoute{defaultRoute},
		},
		{
			name:                "notifications provisioning:read can read only default route",
			user:                user(ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningRead}),
			includeProvisioning: true,
			expected:            []testRoute{defaultRoute},
		},
		{
			name: "provisioning:read + scoped read gives default + scoped routes",
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			includeProvisioning: true,
			expected:            []testRoute{defaultRoute, route1},
		},
		{
			name:                "provisioning:read has no effect when provisioning actions disabled",
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			includeProvisioning: false,
			expected:            nil,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			svc := NewRouteAccess[testRoute](&recordingAccessControlFake{}, fakes.NewFakeRoutePermissionsService(), testCase.includeProvisioning)

			actual, err := svc.FilterRead(context.Background(), testCase.user, allRoutes...)

			if testCase.expected == nil {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, testCase.expected, actual)
			}
		})
	}
}

func TestRouteAccessAuthorizeLegacy(t *testing.T) {
	defaultRoute := testRoute{name: legacy_storage.UserDefinedRoutingTreeName}
	route1 := testRoute{name: "route-1"}

	user := func(perms ...ac.Permission) identity.Requester {
		return ac.BackgroundUser("test", orgID, org.RoleNone, perms)
	}

	testCases := []struct {
		name      string
		authorize func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error
		user      identity.Requester
		expectErr bool
	}{
		// AuthorizeCreate — legacy actions do NOT grant create.
		{
			name: "legacy routes:write cannot create",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeCreate(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingRoutesWrite}),
			expectErr: true,
		},
		{
			name: "legacy notifications:write cannot create",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeCreate(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingNotificationsWrite}),
			expectErr: true,
		},
		{
			name: "reader cannot create",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeCreate(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingRoutesRead}),
			expectErr: true,
		},
		// AuthorizeUpdate — legacy actions only apply to the default route.
		{
			name: "legacy routes:write can update default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expectErr: false,
		},
		{
			name: "legacy notifications:write can update default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingNotificationsRead},
				ac.Permission{Action: ac.ActionAlertingNotificationsWrite},
			),
			expectErr: false,
		},
		{
			name: "legacy routes:write cannot update non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expectErr: true,
		},
		// AuthorizeDelete — legacy actions only apply to the default route.
		{
			name: "legacy routes:write can delete default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expectErr: false,
		},
		{
			name: "legacy notifications:write can delete default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingNotificationsRead},
				ac.Permission{Action: ac.ActionAlertingNotificationsWrite},
			),
			expectErr: false,
		},
		{
			name: "legacy routes:write cannot delete non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expectErr: true,
		},
		{
			name: "legacy notifications:write cannot delete non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingNotificationsRead},
				ac.Permission{Action: ac.ActionAlertingNotificationsWrite},
			),
			expectErr: true,
		},
		// Mixed: legacy + scoped on the default route.
		{
			// Legacy read satisfies read, new scoped write satisfies update — both combine for the default route.
			name: "legacy routes:read + scoped managed:write can update default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(defaultRoute.name)},
			),
			expectErr: false,
		},
		{
			// New scoped read satisfies read, legacy write satisfies update on the default route.
			name: "scoped managed:read + legacy routes:write can update default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(defaultRoute.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expectErr: false,
		},
		{
			// Legacy write also covers delete on the default route; scoped read satisfies the read prerequisite.
			name: "scoped managed:read + legacy routes:write can delete default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(defaultRoute.name)},
				ac.Permission{Action: ac.ActionAlertingRoutesWrite},
			),
			expectErr: false,
		},
		{
			// Scoped write requires scoped read. Legacy routes:read only covers the default route,
			// so scoped write on route-1 without scoped read grants nothing on route-1.
			name: "legacy routes:read + scoped managed:write requires scoped read on non-default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingRoutesRead},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expectErr: true,
		},
		// Verify legacy actions do NOT satisfy "all routes" evaluators.
		{
			name: "legacy routes:read does not satisfy readAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.read.AuthorizeAll(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingRoutesRead}),
			expectErr: true,
		},
		{
			name: "legacy routes:write does not satisfy updateAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.update.AuthorizeAll(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingRoutesWrite}),
			expectErr: true,
		},
		{
			name: "legacy routes:write does not satisfy deleteAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.delete.AuthorizeAll(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingRoutesWrite}),
			expectErr: true,
		},
		{
			name: "legacy notifications:read does not satisfy readAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.read.AuthorizeAll(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingNotificationsRead}),
			expectErr: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			svc := NewRouteAccess[testRoute](&recordingAccessControlFake{}, fakes.NewFakeRoutePermissionsService(), false)

			err := testCase.authorize(svc, context.Background(), testCase.user)

			if testCase.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRouteAccessAuthorizeScoped(t *testing.T) {
	route1 := testRoute{name: "route-1"}
	route2 := testRoute{name: "route-2"}

	user := func(perms ...ac.Permission) identity.Requester {
		return ac.BackgroundUser("test", orgID, org.RoleNone, perms)
	}

	testCases := []struct {
		name      string
		authorize func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error
		user      identity.Requester
		expectErr bool
	}{
		// AuthorizeCreate.
		{
			name: "scoped creator can create",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeCreate(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesCreate}),
			expectErr: false,
		},
		{
			name: "user without create action cannot create",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeCreate(ctx, user)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesAll}),
			expectErr: true,
		},
		// AuthorizeRead.
		{
			name: "scoped managed:read can read scoped route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, route1)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)}),
			expectErr: false,
		},
		{
			name: "global managed:read can read any route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, route2)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll}),
			expectErr: false,
		},
		{
			name: "user without managed:read cannot read route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, route1)
			},
			user:      user(),
			expectErr: true,
		},
		{
			name: "scoped managed:read on other route cannot read route1",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, route1)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)}),
			expectErr: true,
		},
		// AuthorizeUpdate.
		{
			name: "scoped writer can update scoped route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expectErr: false,
		},
		{
			name: "global writer can update any route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route2)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesAll},
			),
			expectErr: false,
		},
		{
			name: "scoped writer cannot update unscoped route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expectErr: true,
		},
		{
			name: "scoped write without read cannot update",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)}),
			expectErr: true,
		},
		// AuthorizeDelete.
		{
			name: "scoped deleter can delete scoped route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expectErr: false,
		},
		{
			name: "global deleter can delete any route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route2)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesAll},
			),
			expectErr: false,
		},
		{
			name: "scoped deleter cannot delete unscoped route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesAll},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route2.name)},
			),
			expectErr: true,
		},
		{
			name: "scoped delete without read cannot delete",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user:      user(ac.Permission{Action: ac.ActionAlertingManagedRoutesDelete, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)}),
			expectErr: true,
		},
		{
			name: "managed:write does not grant delete",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingManagedRoutesRead, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
				ac.Permission{Action: ac.ActionAlertingManagedRoutesWrite, Scope: models.ScopeRoutesProvider.GetResourceScopeUID(route1.name)},
			),
			expectErr: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			svc := NewRouteAccess[testRoute](&recordingAccessControlFake{}, fakes.NewFakeRoutePermissionsService(), false)

			err := testCase.authorize(svc, context.Background(), testCase.user)

			if testCase.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestRouteAccessAuthorizeProvisioning(t *testing.T) {
	defaultRoute := testRoute{name: legacy_storage.UserDefinedRoutingTreeName}
	route1 := testRoute{name: "route-1"}

	user := func(perms ...ac.Permission) identity.Requester {
		return ac.BackgroundUser("test", orgID, org.RoleNone, perms)
	}

	testCases := []struct {
		name                string
		authorize           func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error
		user                identity.Requester
		includeProvisioning bool
		expectErr           bool
	}{
		// Provisioning read grants access to the default route only.
		{
			name: "provisioning:read can read default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, defaultRoute)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			includeProvisioning: true,
			expectErr:           false,
		},
		{
			name: "provisioning:read cannot read non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, route1)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			includeProvisioning: true,
			expectErr:           true,
		},
		{
			name: "notifications provisioning:read can read default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, defaultRoute)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningRead}),
			includeProvisioning: true,
			expectErr:           false,
		},
		{
			name: "notifications provisioning:read cannot read non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, route1)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningRead}),
			includeProvisioning: true,
			expectErr:           true,
		},
		// Provisioning write + read grants update/delete on default route only.
		{
			name: "provisioning read+write can update default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           false,
		},
		{
			name: "provisioning read+write cannot update non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           true,
		},
		{
			name: "provisioning read+write can delete default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           false,
		},
		{
			name: "provisioning read+write cannot delete non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeDelete(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           true,
		},
		{
			name: "notifications provisioning read+write can update default route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           false,
		},
		{
			name: "notifications provisioning read+write cannot update non-default managed route",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, route1)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingNotificationsProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           true,
		},
		// Provisioning write alone (without provisioning read) cannot update — read is still required.
		{
			name: "provisioning:write alone cannot update default route (read required)",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeUpdate(ctx, user, defaultRoute)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningWrite}),
			includeProvisioning: true,
			expectErr:           true,
		},
		// Provisioning permissions do NOT satisfy the "all routes" evaluators.
		{
			name: "provisioning:read does not satisfy readAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.read.AuthorizeAll(ctx, user)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			includeProvisioning: true,
			expectErr:           true,
		},
		{
			name: "provisioning read+write does not satisfy updateAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.update.AuthorizeAll(ctx, user)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           true,
		},
		{
			name: "provisioning read+write does not satisfy deleteAll evaluator",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.delete.AuthorizeAll(ctx, user)
			},
			user: user(
				ac.Permission{Action: ac.ActionAlertingProvisioningRead},
				ac.Permission{Action: ac.ActionAlertingProvisioningWrite},
			),
			includeProvisioning: true,
			expectErr:           true,
		},
		// Without includeProvisioningActions, provisioning actions have no effect.
		{
			name: "provisioning:read has no effect when provisioning actions disabled",
			authorize: func(svc *RouteAccess[testRoute], ctx context.Context, user identity.Requester) error {
				return svc.AuthorizeRead(ctx, user, defaultRoute)
			},
			user:                user(ac.Permission{Action: ac.ActionAlertingProvisioningRead}),
			includeProvisioning: false,
			expectErr:           true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			svc := NewRouteAccess[testRoute](&recordingAccessControlFake{}, fakes.NewFakeRoutePermissionsService(), testCase.includeProvisioning)

			err := testCase.authorize(svc, context.Background(), testCase.user)

			if testCase.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
