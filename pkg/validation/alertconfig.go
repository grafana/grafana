package validation

import (
	"github.com/grafana/alerting-api/pkg/api"
	"github.com/prometheus/alertmanager/config"
)

// GrafanaAlertingConfig contains only the Grafana managed alerting configurations.
type GrafanaAlertingConfig struct {
	api.GrafanaReceivers
	Route     *config.Route `yaml:"route,omitempty" json:"route,omitempty"`
	Templates []string      `yaml:"templates" json:"templates"`
}

// func SplitAlertingConfig(apiConf api.ApiAlertingConfig) (amConfig config.Config, gConfig GrafanaAlertingConfig, err error) {

// }

// func MergeAlertingConfigs(amConfig config.Config, gConfig GrafanaAlertingConfig) (conf api.ApiAlertingConfig, err error) {
// }

// Routing trees must either contain only Grafana Managed receiver types or AlertManager receiver types
// func SplitRoutes(routes []*config.Route, receivers map[string]*api.ApiReceiver) (gRoutes, amRoutes []*config.Route, err error) {
// 	for _, route := range routes {
// 	}
// }

func allReceivers(route *config.Route) (res []string) {
	res = append(res, route.Receiver)
	for _, subRoute := range route.Routes {
		res = append(res, allReceivers(subRoute)...)
	}
	return res
}
