package checkregistry

import (
	"github.com/grafana/grafana/apps/advisor2/pkg/app/checks"
)

type CheckService interface {
	Checks() []checks.Check
}

// AdvisorAppConfig is the configuration received from Grafana to run the app
type AdvisorAppConfig struct {
	CheckRegistry CheckService
	PluginConfig  map[string]string
	StackID       string
}
