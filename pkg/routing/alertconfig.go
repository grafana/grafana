package routing

import (
	"github.com/grafana/alerting-api/pkg/api"
	"github.com/prometheus/alertmanager/config"
)

// GrafanaAlertingConfig contains only the Grafana managed alerting configurations.
type GrafanaAlertingConfig struct {
	Route     *config.Route      `yaml:"route,omitempty" json:"route,omitempty"`
	Templates []string           `yaml:"templates" json:"templates"`
	Receivers []*GrafanaReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type GrafanaReceiver struct {
	// A unique identifier for this receiver.
	Name string `yaml:"name" json:"name"`
	api.GrafanaReceivers
}

func SplitAlertingConfig(apiConf api.ApiAlertingConfig) (amConfig config.Config, gConfig GrafanaAlertingConfig, err error) {

	var gReceivers []*GrafanaReceiver
	var amReceivers []*config.Receiver
	for _, r := range apiConf.Receivers {
		t := r.Type()
		if t == api.GrafanaReceiverType {
			gReceivers = append(gReceivers, &GrafanaReceiver{
				Name:             r.Name,
				GrafanaReceivers: r.GrafanaReceivers,
			})
		} else {
			amReceivers = append(amReceivers, &r.Receiver)
		}
	}

	// Create Grafana specific config
	gConfig.Templates = apiConf.Templates
	gConfig.Route = apiConf.GrafanaManagedRoute
	gConfig.Receivers = gReceivers

	// Create AM specific config
	amConfig = apiConf.Config
	amConfig.Route = apiConf.AlertManagerRoute
	amConfig.Receivers = amReceivers

	return amConfig, gConfig, nil
}
