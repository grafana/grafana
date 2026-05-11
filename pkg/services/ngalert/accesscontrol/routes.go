package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

var (
	// Legacy actions — grant access to the default route only, not to other managed routes.
	legacyReadRoutePermissions = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsRead), // Legacy system-wide action.
		ac.EvalPermission(ac.ActionAlertingRoutesRead),        // Legacy route-specific action.
	)
	legacyWriteRoutePermissions = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite), // Legacy system-wide action.
		ac.EvalPermission(ac.ActionAlertingRoutesWrite),        // Legacy route-specific action.
	)

	// Provisioning actions — like legacy, grant access to the default route only, not to other managed routes.
	provisioningReadRoutePermissions = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningRead),              // Global provisioning action. Org scope.
		ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // Notifications provisioning action. Org scope.
	)
	provisioningWriteRoutePermissions = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningWrite),              // Global provisioning action. Org scope.
		ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningWrite), // Notifications provisioning action. Org scope.
	)

	// Read

	// Asserts pre-conditions for read access to routes (new scoped action only; legacy is added via extendAccessControl).
	readRoutesPreConditionsEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesRead)

	// Asserts read-only access to all routes. Legacy/provisioning actions do NOT grant access to all managed routes.
	readAllRoutesEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesRead, models.ScopeRoutesAll)

	// Asserts read-only access to a specific route (new scoped action only; legacy is added via extendAccessControl).
	readRouteEval = func(name string) ac.Evaluator {
		return ac.EvalPermission(ac.ActionAlertingManagedRoutesRead, models.ScopeRoutesProvider.GetResourceScopeUID(name))
	}

	// Create

	// Asserts create access to routes. Create is org-level only; legacy/provisioning actions do NOT grant create.
	createRoutesEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesCreate)

	// Update

	// Asserts pre-conditions for update access to routes (new scoped action only; legacy is added via extendAccessControl).
	updateRoutesPreConditionsEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesWrite)

	// Asserts update access to all routes. Legacy/provisioning actions do NOT grant access to all managed routes.
	updateAllRoutesEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesWrite, models.ScopeRoutesAll)

	// Asserts update access to a specific route (new scoped action only; legacy is added via extendAccessControl).
	updateRouteEval = func(name string) ac.Evaluator {
		return ac.EvalPermission(ac.ActionAlertingManagedRoutesWrite, models.ScopeRoutesProvider.GetResourceScopeUID(name))
	}

	// Delete

	// Asserts pre-conditions for delete access to routes (new scoped action only; legacy is added via extendAccessControl).
	deleteRoutesPreConditionsEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesDelete)

	// Asserts delete access to all routes. Legacy/provisioning actions do NOT grant access to all managed routes.
	deleteAllRoutesEval = ac.EvalPermission(ac.ActionAlertingManagedRoutesDelete, models.ScopeRoutesAll)

	// Asserts delete access to a specific route (new scoped action only; legacy is added via extendAccessControl).
	deleteRouteEval = func(name string) ac.Evaluator {
		return ac.EvalPermission(ac.ActionAlertingManagedRoutesDelete, models.ScopeRoutesProvider.GetResourceScopeUID(name))
	}

	// Admin (permissions management)

	// Asserts pre-conditions for resource permissions access to routes.
	permissionsRoutesPreConditionsEval = ac.EvalAll(
		ac.EvalPermission(ac.ActionAlertingRoutesPermissionsRead),
		ac.EvalPermission(ac.ActionAlertingRoutesPermissionsWrite),
	)

	// Asserts resource permissions access to all routes.
	permissionsAllRoutesEval = ac.EvalAll(
		ac.EvalPermission(ac.ActionAlertingRoutesPermissionsRead, models.ScopeRoutesAll),
		ac.EvalPermission(ac.ActionAlertingRoutesPermissionsWrite, models.ScopeRoutesAll),
	)

	// Asserts resource permissions access to a specific route.
	permissionsRouteEval = func(name string) ac.Evaluator {
		return ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingRoutesPermissionsRead, models.ScopeRoutesProvider.GetResourceScopeUID(name)),
			ac.EvalPermission(ac.ActionAlertingRoutesPermissionsWrite, models.ScopeRoutesProvider.GetResourceScopeUID(name)),
		)
	}
)

// defaultRouteOnly builds an actionAccess extension that applies the given evaluator only to the default route.
// It satisfies the pre-condition (user can access the default route) but does NOT satisfy the all-routes evaluator.
func defaultRouteOnly[T models.Identified](eval ac.Evaluator) actionAccess[T] {
	return actionAccess[T]{
		authorizeSome: eval,                  // satisfies pre-condition — user can access at least the default route
		authorizeAll:  ac.EvalPermission(""), // never satisfied — does NOT grant access to all routes
		authorizeOne: func(route models.Identified) ac.Evaluator {
			if route.GetUID() == legacy_storage.UserDefinedRoutingTreeName {
				return eval
			}
			return ac.EvalPermission("") // never satisfied — does not apply to non-default routes
		},
	}
}

type permissionsService interface {
	DeleteResourcePermissions(ctx context.Context, orgID int64, routeUID string) error
	SetDefaultPermissions(ctx context.Context, orgID int64, user identity.Requester, routeUID string) error
}

type RouteAccess[T models.Identified] struct {
	read              actionAccess[T]
	create            actionAccess[T]
	update            actionAccess[T]
	delete            actionAccess[T]
	permissions       actionAccess[T]
	permissionService permissionsService
}

// NewRouteAccess creates a new RouteAccess service. If includeProvisioningActions is true, the service will also
// accept provisioning-specific permissions for the default route (alert.provisioning:read/write and
// alert.notifications.provisioning:read/write). Like legacy permissions, provisioning permissions only grant access to
// the default route, not to other managed routes.
func NewRouteAccess[T models.Identified](a ac.AccessControl, permissionsService permissionsService, includeProvisioningActions bool) *RouteAccess[T] {
	routeAccess := &RouteAccess[T]{
		permissionService: permissionsService,
		read: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "route",
			action:        "read",
			authorizeSome: readRoutesPreConditionsEval,
			authorizeOne: func(route models.Identified) ac.Evaluator {
				return readRouteEval(route.GetUID())
			},
			authorizeAll: readAllRoutesEval,
		},
		create: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "route",
			action:        "create",
			authorizeSome: createRoutesEval,
			authorizeOne: func(route models.Identified) ac.Evaluator {
				return createRoutesEval
			},
			authorizeAll: createRoutesEval,
		},
		update: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "route",
			action:        "update",
			authorizeSome: updateRoutesPreConditionsEval,
			authorizeOne: func(route models.Identified) ac.Evaluator {
				return updateRouteEval(route.GetUID())
			},
			authorizeAll: updateAllRoutesEval,
		},
		delete: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "route",
			action:        "delete",
			authorizeSome: deleteRoutesPreConditionsEval,
			authorizeOne: func(route models.Identified) ac.Evaluator {
				return deleteRouteEval(route.GetUID())
			},
			authorizeAll: deleteAllRoutesEval,
		},
		permissions: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "route",
			action:        "admin",
			authorizeSome: permissionsRoutesPreConditionsEval,
			authorizeOne: func(route models.Identified) ac.Evaluator {
				return permissionsRouteEval(route.GetUID())
			},
			authorizeAll: permissionsAllRoutesEval,
		},
	}

	// Legacy permissions apply to the default route only.
	extendAccessControl(&routeAccess.read, ac.EvalAny, defaultRouteOnly[T](legacyReadRoutePermissions))
	extendAccessControl(&routeAccess.update, ac.EvalAny, defaultRouteOnly[T](legacyWriteRoutePermissions))
	extendAccessControl(&routeAccess.delete, ac.EvalAny, defaultRouteOnly[T](legacyWriteRoutePermissions))

	// Provisioning permissions also apply to the default route only (same as legacy).
	if includeProvisioningActions {
		extendAccessControl(&routeAccess.read, ac.EvalAny, defaultRouteOnly[T](provisioningReadRoutePermissions))
		extendAccessControl(&routeAccess.update, ac.EvalAny, defaultRouteOnly[T](provisioningWriteRoutePermissions))
		extendAccessControl(&routeAccess.delete, ac.EvalAny, defaultRouteOnly[T](provisioningWriteRoutePermissions))
	}

	// Write, delete, and permissions management should require read permissions.
	extendAccessControl(&routeAccess.update, ac.EvalAll, routeAccess.read)
	extendAccessControl(&routeAccess.delete, ac.EvalAll, routeAccess.read)
	extendAccessControl(&routeAccess.permissions, ac.EvalAll, routeAccess.read)

	return routeAccess
}

// FilterRead filters the given list of routes based on the read access control permissions of the user.
func (s RouteAccess[T]) FilterRead(ctx context.Context, user identity.Requester, routes ...T) ([]T, error) {
	return s.read.Filter(ctx, user, routes...)
}

// AuthorizeRead checks if user has access to read a route.
func (s RouteAccess[T]) AuthorizeRead(ctx context.Context, user identity.Requester, route T) error {
	return s.read.Authorize(ctx, user, route)
}

// HasRead checks if user has access to read a route.
func (s RouteAccess[T]) HasRead(ctx context.Context, user identity.Requester, route T) (bool, error) {
	return s.read.Has(ctx, user, route)
}

// AuthorizeReadSome checks if user has access to read some routes.
func (s RouteAccess[T]) AuthorizeReadSome(ctx context.Context, user identity.Requester) error {
	return s.read.AuthorizePreConditions(ctx, user)
}

// AuthorizeCreate checks if user has access to create routes.
func (s RouteAccess[T]) AuthorizeCreate(ctx context.Context, user identity.Requester) error {
	return s.create.AuthorizeAll(ctx, user)
}

// AuthorizeUpdate checks if user has access to update a route.
func (s RouteAccess[T]) AuthorizeUpdate(ctx context.Context, user identity.Requester, route T) error {
	return s.update.Authorize(ctx, user, route)
}

// AuthorizeDelete checks if user has access to delete a route.
func (s RouteAccess[T]) AuthorizeDelete(ctx context.Context, user identity.Requester, route T) error {
	return s.delete.Authorize(ctx, user, route)
}

// AuthorizeDeleteByUID checks if user has access to delete a route by name.
func (s RouteAccess[T]) AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, name string) error {
	return s.delete.Authorize(ctx, user, identified{uid: name})
}

// AuthorizeUpdateByUID checks if user has access to update a route by name.
func (s RouteAccess[T]) AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, name string) error {
	return s.update.Authorize(ctx, user, identified{uid: name})
}

// AuthorizeReadByUID checks if user has access to read a route by name.
func (s RouteAccess[T]) AuthorizeReadByUID(ctx context.Context, user identity.Requester, name string) error {
	return s.read.Authorize(ctx, user, identified{uid: name})
}

func (s RouteAccess[T]) DeleteAllPermissions(ctx context.Context, orgID int64, route *legacy_storage.ManagedRoute) error {
	return s.permissionService.DeleteResourcePermissions(ctx, orgID, route.GetUID())
}

func (s RouteAccess[T]) SetDefaultPermissions(ctx context.Context, user identity.Requester, route *legacy_storage.ManagedRoute) error {
	return s.permissionService.SetDefaultPermissions(ctx, user.GetOrgID(), user, route.GetUID())
}

// Access returns the permission sets for a slice of routes.
func (s RouteAccess[T]) Access(ctx context.Context, user identity.Requester, routes ...T) (map[string]models.RoutePermissionSet, error) {
	basePerms := models.NewRoutePermissionSet()

	if err := s.permissions.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.RoutePermissionAdmin, false)
	} else if err := s.permissions.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.RoutePermissionAdmin, true)
	}

	if err := s.update.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.RoutePermissionWrite, false)
	} else if err := s.update.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.RoutePermissionWrite, true)
	}

	if err := s.delete.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.RoutePermissionDelete, false)
	} else if err := s.delete.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.RoutePermissionDelete, true)
	}

	if basePerms.AllSet() {
		result := make(map[string]models.RoutePermissionSet, len(routes))
		for _, r := range routes {
			result[r.GetUID()] = basePerms.Clone()
		}
		return result, nil
	}

	result := make(map[string]models.RoutePermissionSet, len(routes))
	for _, r := range routes {
		permSet := basePerms.Clone()
		if _, ok := permSet.Has(models.RoutePermissionAdmin); !ok {
			err := s.permissions.authorize(ctx, user, r)
			permSet.Set(models.RoutePermissionAdmin, err == nil)
		}

		if _, ok := permSet.Has(models.RoutePermissionWrite); !ok {
			err := s.update.authorize(ctx, user, r)
			permSet.Set(models.RoutePermissionWrite, err == nil)
		}

		if _, ok := permSet.Has(models.RoutePermissionDelete); !ok {
			err := s.delete.authorize(ctx, user, r)
			permSet.Set(models.RoutePermissionDelete, err == nil)
		}

		result[r.GetUID()] = permSet
	}
	return result, nil
}
