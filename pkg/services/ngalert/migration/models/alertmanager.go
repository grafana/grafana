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
	Config      *apiModels.PostableUserConfig
	legacyRoute *apiModels.Route
}

// NewAlertmanager creates a new Alertmanager.
func NewAlertmanager() *Alertmanager {
	c, r := createBaseConfig()
	return &Alertmanager{
		Config:      c,
		legacyRoute: r,
	}
}

// AddRoute adds a route to the alertmanager config.
func (am *Alertmanager) AddRoute(route *apiModels.Route) {
	am.legacyRoute.Routes = append(am.legacyRoute.Routes, route)
}

// AddReceiver adds a receiver to the alertmanager config.
func (am *Alertmanager) AddReceiver(recv *apiModels.PostableApiReceiver) {
	am.Config.AlertmanagerConfig.Receivers = append(am.Config.AlertmanagerConfig.Receivers, recv)
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
