package legacy_storage

import (
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

const NamedRouteMatcher = models.NamedRouteLabel

func GeneratedSubRoute(r *v1.ManagedRoute) *v1.Route {
	amRoute := ManagedRouteToRoute(r)

	// It's important that the generated sub-route is fully defined so that they will never rely on the values of the root.
	defaultOpts := dispatch.DefaultRouteOpts
	if amRoute.GroupWait == nil {
		gw := model.Duration(defaultOpts.GroupWait)
		amRoute.GroupWait = &gw
	}
	if amRoute.GroupInterval == nil {
		gi := model.Duration(defaultOpts.GroupInterval)
		amRoute.GroupInterval = &gi
	}
	if amRoute.RepeatInterval == nil {
		ri := model.Duration(defaultOpts.RepeatInterval)
		amRoute.RepeatInterval = &ri
	}
	if !models.IsDefaultRoutingTreeName(r.GetUID()) {
		// Set label matcher.
		amRoute.ObjectMatchers = v1.ObjectMatchers{managedRouteMatcher(r.GetUID())}
	}
	return &amRoute
}

func managedRouteMatcher(name string) *labels.Matcher {
	return &labels.Matcher{
		Type:  labels.MatchEqual,
		Name:  NamedRouteMatcher,
		Value: name,
	}
}

func WithManagedRoutes(root *v1.Route, managedRoutes map[string]*v1.Route) *v1.Route {
	if len(managedRoutes) == 0 {
		// If there are no managed routes, we just return the original root.
		return root
	}
	newRoot := *root
	newManagedRoutes := make([]*v1.Route, 0, len(newRoot.Routes)+len(managedRoutes))
	for _, k := range slices.Sorted(maps.Keys(managedRoutes)) {
		// On the off chance that the route is nil or invalid managed route with the restricted name, we skip it.
		if managedRoutes[k] == nil || models.IsDefaultRoutingTreeName(k) {
			continue
		}
		newManagedRoutes = append(newManagedRoutes, GeneratedSubRoute(v1.NewManagedRoute(k, managedRoutes[k])))
	}

	// Add the default routing tree at the end.
	newManagedRoutes = append(newManagedRoutes, newRoot.Routes...)
	newRoot.Routes = newManagedRoutes
	return &newRoot
}

func (rev *ConfigRevision) GetManagedRoute(name string) *v1.ManagedRoute {
	if models.IsDefaultRoutingTreeName(name) {
		// Echo the requested name (canonical or alias) so the response preserves the name
		// the client used, while GetUID/ResourceID canonicalize for identity purposes.
		return v1.NewManagedRoute(name, rev.Config.AlertmanagerConfig.Route)
	}
	route, ok := rev.Config.ManagedRoutes[name]
	if !ok {
		return nil
	}
	return v1.NewManagedRoute(name, route)
}

func (rev *ConfigRevision) GetManagedRoutes() v1.ManagedRoutes {
	managedRoutes := make(v1.ManagedRoutes, 0, len(rev.Config.ManagedRoutes)+1)
	for _, k := range slices.Sorted(maps.Keys(rev.Config.ManagedRoutes)) {
		// On the off chance that the route is nil or invalid managed route with the restricted name, we skip it.
		if rev.Config.ManagedRoutes[k] == nil || models.IsDefaultRoutingTreeName(k) {
			continue
		}
		managedRoutes = append(managedRoutes, v1.NewManagedRoute(k, rev.Config.ManagedRoutes[k]))
	}
	managedRoutes = append(managedRoutes, v1.NewManagedRoute(models.DefaultRoutingTreeName, rev.Config.AlertmanagerConfig.Route))

	return managedRoutes
}

func (rev *ConfigRevision) DeleteManagedRoute(name string) {
	delete(rev.Config.ManagedRoutes, name)
}

// validateManagedRouteName validates that a managed route name is non-empty, does not contain ':', and is a valid DNS1123 subdomain.
func validateManagedRouteName(name string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("route name is required")
	}
	// Colon in names confuses RBAC. Make sure we do not allow that.
	if strings.Contains(name, ":") {
		return fmt.Errorf("managed route name cannot contain invalid character ':'")
	}
	if len(name) > ualert.UIDMaxLength {
		return fmt.Errorf("managed route name cannot be longer than %d characters", ualert.UIDMaxLength)
	}
	if errs := k8svalidation.IsDNS1123Subdomain(name); len(errs) > 0 {
		return fmt.Errorf("managed route name must be a valid DNS subdomain: %s", strings.Join(errs, ", "))
	}
	return nil
}

func (rev *ConfigRevision) CreateManagedRoute(name string, subtree v1.Route) (*v1.ManagedRoute, error) {
	if err := validateManagedRouteName(name); err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	if models.IsDefaultRoutingTreeName(name) {
		return nil, models.ErrRouteExists.Errorf("cannot create a managed route with the name %q, this name is reserved for the default routing tree", name)
	}

	if _, exists := rev.Config.ManagedRoutes[name]; exists {
		return nil, models.ErrRouteExists.Errorf("")
	}

	managedRoute := v1.NewManagedRoute(name, &subtree)
	amRoute := ManagedRouteToRoute(managedRoute)

	err := rev.ValidateRoute(amRoute)
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	if rev.Config.ManagedRoutes == nil {
		rev.Config.ManagedRoutes = make(map[string]*v1.Route, 1)
	}
	rev.Config.ManagedRoutes[name] = &amRoute

	return managedRoute, nil
}

func (rev *ConfigRevision) UpdateNamedRoute(name string, subtree v1.Route) (*v1.ManagedRoute, error) {
	if name == "" {
		return nil, fmt.Errorf("route name is required")
	}

	if existing := rev.GetManagedRoute(name); existing == nil {
		return nil, fmt.Errorf("managed route %q not found", name)
	}

	managedRoute := v1.NewManagedRoute(name, &subtree)
	amRoute := ManagedRouteToRoute(managedRoute)

	err := rev.ValidateRoute(amRoute)
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	if models.IsDefaultRoutingTreeName(name) {
		rev.Config.AlertmanagerConfig.Route = &amRoute
	} else {
		if rev.Config.ManagedRoutes == nil {
			rev.Config.ManagedRoutes = make(map[string]*v1.Route, 1)
		}
		rev.Config.ManagedRoutes[name] = &amRoute
	}

	return managedRoute, nil
}

func (rev *ConfigRevision) ResetUserDefinedRoute(defaultCfg *v1.AMConfigV1) (*v1.ManagedRoute, error) {
	// Ensure the new default receiver exists and if not, create it.
	if err := rev.validateReceiverReferences(*defaultCfg.AlertmanagerConfig.Route); err != nil {
		// Default receiver doesn't exist, create it.
		defaultRcvUID := v1.ReceiverUID(defaultCfg.AlertmanagerConfig.Route.Receiver) // TODO: This could work with static UIDs but a predetermined UID might make more sense.
		defaultRcv, ok := defaultCfg.Receivers[defaultRcvUID]
		if !ok {
			return nil, fmt.Errorf("inconsistent default configuration: default receiver %q not found", defaultCfg.AlertmanagerConfig.Route.Receiver)
		}
		if rev.Config.Receivers == nil {
			rev.Config.Receivers = make(map[v1.ResourceUID]v1.PostableApiReceiver, 1)
		}
		rev.Config.Receivers[defaultRcvUID] = defaultRcv
	}

	return rev.UpdateNamedRoute(models.DefaultRoutingTreeName, *defaultCfg.AlertmanagerConfig.Route)
}

func (rev *ConfigRevision) ValidateRoute(route v1.Route) error {
	err := route.Validate()
	if err != nil {
		return err
	}

	err = rev.validateReceiverReferences(route)
	if err != nil {
		return err
	}

	err = rev.validateTimeIntervalReferences(route)
	if err != nil {
		return err
	}
	return nil
}

func (rev *ConfigRevision) validateReceiverReferences(route v1.Route) error {
	return route.ValidateReceivers(rev.GetReceiversNames())
}

func (rev *ConfigRevision) validateTimeIntervalReferences(route v1.Route) error {
	timeIntervals := map[string]struct{}{}
	for _, ti := range rev.Config.TimeIntervals {
		timeIntervals[ti.Title] = struct{}{}
	}
	return route.ValidateTimeIntervals(timeIntervals)
}

// RenameReceiverInRoutes renames all references to a receiver in all routes. Returns number of routes that were updated
func (rev *ConfigRevision) RenameReceiverInRoutes(oldName, newName string) map[*v1.Route]int {
	res := make(map[*v1.Route]int)
	if cnt := renameReceiverInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route); cnt > 0 {
		res[rev.Config.AlertmanagerConfig.Route] = cnt
	}
	for _, r := range rev.Config.ManagedRoutes {
		if cnt := renameReceiverInRoute(oldName, newName, r); cnt > 0 {
			res[r] = cnt
		}
	}
	return res
}

func renameReceiverInRoute(oldName, newName string, routes ...*v1.Route) int {
	if len(routes) == 0 {
		return 0
	}
	updated := 0
	for _, route := range routes {
		if route.Receiver == oldName {
			route.Receiver = newName
			updated++
		}
		updated += renameReceiverInRoute(oldName, newName, route.Routes...)
	}
	return updated
}

// TimeIntervalUsedByRoutes checks if a time interval is used in any routes.
func (rev *ConfigRevision) TimeIntervalUsedByRoutes(name string) bool {
	if isTimeIntervalInUse(name, []*v1.Route{rev.Config.AlertmanagerConfig.Route}) {
		return true
	}
	for _, r := range rev.Config.ManagedRoutes {
		if isTimeIntervalInUse(name, []*v1.Route{r}) {
			return true
		}
	}
	return false
}

// isTimeIntervalInUse checks if a time interval is used in a route or any of its sub-routes.
func isTimeIntervalInUse(name string, routes []*v1.Route) bool {
	for _, route := range routes {
		if route == nil {
			continue
		}
		if slices.Contains(route.MuteTimeIntervals, name) {
			return true
		}
		if slices.Contains(route.ActiveTimeIntervals, name) {
			return true
		}
		if isTimeIntervalInUse(name, route.Routes) {
			return true
		}
	}
	return false
}

// RenameTimeIntervalInRoutes renames all references to a time interval in all routes. Returns number of routes that were updated
func (rev *ConfigRevision) RenameTimeIntervalInRoutes(oldName, newName string) map[*v1.Route]int {
	res := make(map[*v1.Route]int)
	if cnt := renameTimeIntervalInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route); cnt > 0 {
		res[rev.Config.AlertmanagerConfig.Route] = cnt
	}
	for _, r := range rev.Config.ManagedRoutes {
		if cnt := renameTimeIntervalInRoute(oldName, newName, r); cnt > 0 {
			res[r] = cnt
		}
	}
	return res
}

func renameTimeIntervalInRoute(oldName, newName string, routes ...*v1.Route) int {
	if len(routes) == 0 {
		return 0
	}
	updated := 0
	for _, route := range routes {
		for idx := range route.MuteTimeIntervals {
			if route.MuteTimeIntervals[idx] == oldName {
				route.MuteTimeIntervals[idx] = newName
				updated++
			}
		}
		for idx := range route.ActiveTimeIntervals {
			if route.ActiveTimeIntervals[idx] == oldName {
				route.ActiveTimeIntervals[idx] = newName
				updated++
			}
		}
		updated += renameTimeIntervalInRoute(oldName, newName, route.Routes...)
	}
	return updated
}
