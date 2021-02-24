package validation

import (
	"fmt"

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
func SplitRoutes(routes []*config.Route, receivers map[string]api.ReceiverType) (gRoutes, amRoutes []*config.Route, err error) {
	for _, route := range routes {
		var grafanaCt, amCt int
		for _, receiver := range allReceivers(route) {
			t, ok := receivers[receiver]
			if !ok {
				return nil, nil, fmt.Errorf("unexpected receiver (%s) is undefined", receiver)
			}

			if t == api.GrafanaReceiverType {
				grafanaCt++
			} else {
				amCt++
			}

		}

		// TODO(owen-d): We may want to eventually support this, but short-circuiting for now
		// to reduce routing tree complexity.
		if grafanaCt > 0 && amCt > 0 {
			return nil, nil, fmt.Errorf("cannot mix Grafana Managed receivers with Alertmanager receivers in the same (non-root) routing tree")
		}

		if grafanaCt > 0 {
			gRoutes = append(gRoutes, route)
		} else {
			amRoutes = append(amRoutes, route)
		}
	}

	return gRoutes, amRoutes, nil
}

func allReceivers(route *config.Route) (res []string) {
	res = append(res, route.Receiver)
	for _, subRoute := range route.Routes {
		res = append(res, allReceivers(subRoute)...)
	}
	return res
}
