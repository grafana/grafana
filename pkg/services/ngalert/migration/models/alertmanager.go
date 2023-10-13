package models

import (
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	apiModels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// UseLegacyChannelsLabel is a private label added to a rule's labels to enable routing to the nested route created
// during migration.
const UseLegacyChannelsLabel = "__use_legacy_channels__"

// Alertmanager is a helper struct for creating migrated alertmanager configs.
type Alertmanager struct {
	config      *apiModels.PostableUserConfig
	legacyRoute *apiModels.Route
}

// FromPostableUserConfig creates an Alertmanager from a PostableUserConfig.
func FromPostableUserConfig(config *apiModels.PostableUserConfig) *Alertmanager {
	if config == nil {
		// No existing amConfig created from a previous migration.
		c, r := createBaseConfig()
		return &Alertmanager{
			config:      c,
			legacyRoute: r,
		}
	} else if config.AlertmanagerConfig.Route == nil {
		// No existing base route created from a previous migration.
		defaultRoute, nestedLegacyChannelRoute := createDefaultRoute()
		config.AlertmanagerConfig.Route = defaultRoute
		return &Alertmanager{
			config:      config,
			legacyRoute: nestedLegacyChannelRoute,
		}
	}
	return &Alertmanager{
		config:      config,
		legacyRoute: getOrCreateNestedLegacyRoute(config),
	}
}

// CleanConfig removes the nested legacy route from the base PostableUserConfig if it's empty.
func (am *Alertmanager) CleanConfig() *apiModels.PostableUserConfig {
	for i, r := range am.config.AlertmanagerConfig.Route.Routes {
		if isNestedLegacyRoute(r) && len(r.Routes) == 0 {
			// Remove empty nested route.
			am.config.AlertmanagerConfig.Route.Routes = append(am.config.AlertmanagerConfig.Route.Routes[:i], am.config.AlertmanagerConfig.Route.Routes[i+1:]...)
			return am.config
		}
	}
	return am.config
}

// AddRoute adds a route to the alertmanager config.
func (am *Alertmanager) AddRoute(route *apiModels.Route) {
	am.legacyRoute.Routes = append(am.legacyRoute.Routes, route)
}

// AddReceiver adds a receiver to the alertmanager config.
func (am *Alertmanager) AddReceiver(recv *apiModels.PostableApiReceiver) {
	am.config.AlertmanagerConfig.Receivers = append(am.config.AlertmanagerConfig.Receivers, recv)
}

// CleanupReceiversAndRoutes removes receivers and routes for channels that are being replaced.
func (am *Alertmanager) CleanupReceiversAndRoutes(pairs ...*ContactPair) {
	// Find all previously migrated ContactPairs for these channels.
	upgradesToReplace := make(map[string]*ContactPointUpgrade)
	for _, pair := range pairs {
		if pair.ContactPointUpgrade != nil && pair.ContactPointUpgrade.Name != "" {
			upgradesToReplace[pair.ContactPointUpgrade.Name] = pair.ContactPointUpgrade
		}
	}

	// Remove receivers for channels that are being replaced.
	var keptReceivers []*apiModels.PostableApiReceiver
	for _, recv := range am.config.AlertmanagerConfig.Receivers {
		if _, ok := upgradesToReplace[recv.Name]; !ok {
			keptReceivers = append(keptReceivers, recv)
		} else {
			// Don't keep receiver and remove all nested routes that reference it.
			// This will fail validation if the user has created other routes that reference this receiver.
			// In that case, they must manually delete the added routes.
			am.removeRoutesForReceiver(recv.Name)
		}
	}
	am.config.AlertmanagerConfig.Receivers = keptReceivers
}

// removeRoutesForReceiver removes all routes that reference the given receiver.
func (am *Alertmanager) removeRoutesForReceiver(recv string) {
	var keptRoutes []*apiModels.Route
	for i, route := range am.legacyRoute.Routes {
		if route.Receiver != recv {
			keptRoutes = append(keptRoutes, am.legacyRoute.Routes[i])
		}
	}
	am.legacyRoute.Routes = keptRoutes
}

// getOrCreateNestedLegacyRoute finds or creates the nested route for migrated channels.
func getOrCreateNestedLegacyRoute(config *apiModels.PostableUserConfig) *apiModels.Route {
	for _, r := range config.AlertmanagerConfig.Route.Routes {
		if isNestedLegacyRoute(r) {
			return r
		}
	}
	nestedLegacyChannelRoute := createNestedLegacyRoute()
	// Add new nested route as the first of the top-level routes.
	config.AlertmanagerConfig.Route.Routes = append([]*apiModels.Route{nestedLegacyChannelRoute}, config.AlertmanagerConfig.Route.Routes...)
	return nestedLegacyChannelRoute
}

// isNestedLegacyRoute checks whether a route is the nested legacy route for migrated channels.
func isNestedLegacyRoute(r *apiModels.Route) bool {
	return len(r.ObjectMatchers) == 1 && r.ObjectMatchers[0].Name == UseLegacyChannelsLabel
}

// createBaseConfig creates an alertmanager config with the root-level route, default receiver, and nested route
// for migrated channels.
func createBaseConfig() (*apiModels.PostableUserConfig, *apiModels.Route) {
	defaultRoute, nestedRoute := createDefaultRoute()
	return &apiModels.PostableUserConfig{
		AlertmanagerConfig: apiModels.PostableApiAlertingConfig{
			Receivers: []*apiModels.PostableApiReceiver{
				{
					Receiver: config.Receiver{
						Name: "autogen-contact-point-default",
					},
					PostableGrafanaReceivers: apiModels.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*apiModels.PostableGrafanaReceiver{},
					},
				},
			},
			Config: apiModels.Config{
				Route: defaultRoute,
			},
		},
	}, nestedRoute
}

// createDefaultRoute creates a default root-level route and associated nested route that will contain all the migrated channels.
func createDefaultRoute() (*apiModels.Route, *apiModels.Route) {
	nestedRoute := createNestedLegacyRoute()
	return &apiModels.Route{
		Receiver:       "autogen-contact-point-default",
		Routes:         []*apiModels.Route{nestedRoute},
		GroupByStr:     []string{ngmodels.FolderTitleLabel, model.AlertNameLabel}, // To keep parity with pre-migration notifications.
		RepeatInterval: nil,
	}, nestedRoute
}

// createNestedLegacyRoute creates a nested route that will contain all the migrated channels.
// This route is matched on the UseLegacyChannelsLabel and mostly exists to keep the migrated channels separate and organized.
func createNestedLegacyRoute() *apiModels.Route {
	mat, _ := labels.NewMatcher(labels.MatchEqual, UseLegacyChannelsLabel, "true")
	return &apiModels.Route{
		ObjectMatchers: apiModels.ObjectMatchers{mat},
		Continue:       true,
	}
}
