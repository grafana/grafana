package legacy_storage

import (
	"fmt"

	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

const UserDefinedRoutingTreeName = "user-defined"
const NamedRouteMatcher = "__grafana_named_subtree__"

func (rev *ConfigRevision) GetNamedRoute(name string, log log.Logger) (*definitions.Route, error) {
	if rev.Config.AlertmanagerConfig.Route == nil {
		return nil, fmt.Errorf("no root route defined in the existing configuration")
	}

	namedRoutes, err := parseNamedRoutes(rev.Config.AlertmanagerConfig.Route, log)
	if err != nil {
		return nil, fmt.Errorf("failed to parse named routes: %w", err)
	}
	return NamedRoutes(namedRoutes).GetNamedRoute(name)
}

func (rev *ConfigRevision) GetNamedRoutes(log log.Logger) ([]*definitions.Route, error) {
	if rev.Config.AlertmanagerConfig.Route == nil {
		return nil, fmt.Errorf("no root route defined in the existing configuration")
	}

	return parseNamedRoutes(rev.Config.AlertmanagerConfig.Route, log)
}

func (rev *ConfigRevision) DeleteNamedRoute(name string) error {
	if name == "" {
		return fmt.Errorf("route name is required")
	}

	if rev.Config.AlertmanagerConfig.Route == nil {
		return nil
	}

	newRoutes := make([]*definitions.Route, 0, len(rev.Config.AlertmanagerConfig.Route.Routes))
	for _, subRoute := range rev.Config.AlertmanagerConfig.Route.Routes {
		if subRoute.Name == name {
			// Remove the sub-route from the routes.
			continue
		}
		newRoutes = append(newRoutes, subRoute)
	}
	rev.Config.AlertmanagerConfig.Route.Routes = newRoutes

	return nil
}

func (rev *ConfigRevision) CreateNamedRoute(subtree definitions.Route) (definitions.Route, error) {
	if rev.Config.AlertmanagerConfig.Route == nil {
		return definitions.Route{}, fmt.Errorf("no root route defined in the existing configuration")
	}

	if subtree.Name == "" {
		return definitions.Route{}, MakeErrRouteInvalidFormat(fmt.Errorf("route name is required"))
	}

	namedRoute := prepareNamedRoot(subtree)

	err := namedRoute.Validate()
	if err != nil {
		return definitions.Route{}, MakeErrRouteInvalidFormat(err)
	}

	err = rev.ValidateRouteReferences(namedRoute)
	if err != nil {
		return definitions.Route{}, MakeErrRouteInvalidFormat(err)
	}

	if namedRoute.Name == UserDefinedRoutingTreeName {
		return definitions.Route{}, fmt.Errorf("cannot create the user-defined route, use update instead")
	}

	newRoutes := make([]*definitions.Route, 0, len(rev.Config.AlertmanagerConfig.Route.Routes)+1)
	// Prepend the new subtree to the existing routes.
	newRoutes = append(newRoutes, &namedRoute)
	for _, subRoute := range rev.Config.AlertmanagerConfig.Route.Routes {
		if subRoute.Name == namedRoute.Name {
			return definitions.Route{}, ErrRouteExists.Errorf("")
		}
		newRoutes = append(newRoutes, subRoute)
	}
	rev.Config.AlertmanagerConfig.Route.Routes = newRoutes
	return namedRoute, nil
}

func (rev *ConfigRevision) UpdateNamedRoute(subtree definitions.Route, log log.Logger) (definitions.Route, error) {
	if rev.Config.AlertmanagerConfig.Route == nil {
		return definitions.Route{}, fmt.Errorf("no root route defined in the existing configuration")
	}

	if subtree.Name == "" {
		return definitions.Route{}, MakeErrRouteInvalidFormat(fmt.Errorf("route name is required"))
	}

	namedRoute := prepareNamedRoot(subtree)

	err := namedRoute.Validate()
	if err != nil {
		return definitions.Route{}, MakeErrRouteInvalidFormat(err)
	}

	err = rev.ValidateRouteReferences(namedRoute)
	if err != nil {
		return definitions.Route{}, MakeErrRouteInvalidFormat(err)
	}

	if namedRoute.Name == UserDefinedRoutingTreeName {
		// Update root-level defaults stored in the user-defined route.
		root := namedRoute                                       // Shallow copy.
		root.Name = ""                                           // Root should not have a name.
		root.Routes = rev.Config.AlertmanagerConfig.Route.Routes // Keep existing named routes.
		rev.Config.AlertmanagerConfig.Route = &root
	}

	for _, subRoute := range rev.Config.AlertmanagerConfig.Route.Routes {
		if subRoute.Name == namedRoute.Name {
			// Update the existing sub-route.
			*subRoute = namedRoute
			return namedRoute, nil
		}
	}

	if namedRoute.Name == UserDefinedRoutingTreeName {
		// To be backwards compatible from before named routes, the user-defined route might not yet be explicitly
		// named in the configuration. We take this opportunity to migrate the empty-named user-defined subtrees at
		// this point and make it explicit.
		namedRoutes, err := parseNamedRoutes(rev.Config.AlertmanagerConfig.Route, log)
		if err != nil {
			return definitions.Route{}, fmt.Errorf("failed to parse named routes: %w", err)
		}
		userDefined, err := NamedRoutes(namedRoutes).GetNamedRoute(UserDefinedRoutingTreeName)
		if err != nil {
			return definitions.Route{}, err
		}
		*userDefined = namedRoute
		rev.Config.AlertmanagerConfig.Route.Routes = namedRoutes

		return namedRoute, nil
	}

	return definitions.Route{}, fmt.Errorf("named route %q not found", namedRoute.Name)
}

func (rev *ConfigRevision) ValidateRouteReferences(route definitions.Route) error {
	receivers := map[string]struct{}{}
	receivers[""] = struct{}{} // Allow empty receiver (inheriting from parent)
	for _, receiver := range rev.GetReceivers(nil) {
		receivers[receiver.Name] = struct{}{}
	}

	err := route.ValidateReceivers(receivers)
	if err != nil {
		return err
	}

	timeIntervals := map[string]struct{}{}
	for _, mt := range rev.Config.AlertmanagerConfig.MuteTimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	for _, mt := range rev.Config.AlertmanagerConfig.TimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	err = route.ValidateTimeIntervals(timeIntervals)
	if err != nil {
		return err
	}
	return nil
}

func parseNamedRoutes(root *definitions.Route, log log.Logger) ([]*definitions.Route, error) {
	named := make([]*definitions.Route, 0, len(root.Routes))
	legacyUnnamedRoutes := make([]*definitions.Route, 0)

	var userDefinedRoute *definitions.Route
	dupes := make(map[string]struct{}, len(root.Routes))
	for i, subRoute := range root.Routes {
		if subRoute == nil {
			continue
		}
		// For legacy reasons, we consider sub-routes with no name to be part of the user-defined named route.
		if subRoute.Name == "" {
			legacyUnnamedRoutes = append(legacyUnnamedRoutes, subRoute)
			continue
		}

		if _, exists := dupes[subRoute.Name]; exists {
			log.Warn("duplicate sub-route name, ignoring duplicate", "name", subRoute.Name, "receiver", subRoute.Receiver, "index", i)
			continue
		}
		dupes[subRoute.Name] = struct{}{}
		if subRoute.Name == UserDefinedRoutingTreeName {
			userDefinedRoute = subRoute
			// Skip for now, we will add it later to ensure it's the last one in the list.
			continue
		}
		named = append(named, subRoute)
	}

	if userDefinedRoute == nil {
		// If we don't have an explicit user-defined named route, it's likely because this is a legacy configuration
		// from before named routes were introduced. That means the user-defined route should be created from the root
		// node and all unnamed routes.
		userDefinedRoute = newUserDefinedNamedRoute(*root, legacyUnnamedRoutes)
	}
	named = append(named, userDefinedRoute)

	return named, nil
}

// Create a new root node for a named route.
func prepareNamedRoot(route definitions.Route) definitions.Route {
	if route.Name != UserDefinedRoutingTreeName {
		// Set label matcher.
		route.ObjectMatchers = definitions.ObjectMatchers{&labels.Matcher{
			Type:  labels.MatchEqual,
			Name:  NamedRouteMatcher,
			Value: route.Name,
		}}
	} else {
		// For the user-defined route, it should always match, so we set an empty matcher.
		route.ObjectMatchers = nil
	}

	// Wipe other matchers to ensure the above matcher is the only one used for this route.
	route.Matchers = nil
	route.Match = nil
	route.MatchRE = nil

	// We explicitly don't continue toward user-defined or other named routes if one matches.
	route.Continue = false
	return route
}

// Create a new user-defined named route based on the given root route.
func newUserDefinedNamedRoute(root definitions.Route, subroutes []*definitions.Route) *definitions.Route {
	root.Name = UserDefinedRoutingTreeName
	root.Routes = subroutes
	udr := prepareNamedRoot(root)
	return &udr
}

type NamedRoutes []*definitions.Route

func (nr NamedRoutes) GetNamedRoute(name string) (*definitions.Route, error) {
	if name == "" {
		return nil, fmt.Errorf("route name is required")
	}
	for _, subRoute := range nr {
		if subRoute == nil {
			continue
		}
		if subRoute.Name == name {
			return subRoute, nil
		}
	}
	return nil, ErrRouteNotFound.Errorf("")
}
