package remote

import (
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
)

func PostableUserConfigToGrafanaAlertmanagerConfig(config *definitions.PostableUserConfig) *client.GrafanaAlertmanagerConfig {
	return &client.GrafanaAlertmanagerConfig{
		TemplateFiles:      config.TemplateFiles,
		AlertmanagerConfig: config.AlertmanagerConfig,
	}
}
