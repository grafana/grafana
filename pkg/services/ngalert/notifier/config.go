package notifier

import (
	"encoding/json"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"
	alertingTemplates "github.com/grafana/alerting/templates"

	api "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func Load(rawConfig []byte) (*api.PostableUserConfig, error) {
	cfg := &api.PostableUserConfig{}

	if err := json.Unmarshal(rawConfig, cfg); err != nil {
		return nil, fmt.Errorf("unable to parse Alertmanager configuration: %w", err)
	}

	return cfg, nil
}

// AlertingConfiguration provides configuration for an Alertmanager.
// It implements the notify.Configuration interface.
type AlertingConfiguration struct {
	route                 *alertingNotify.Route
	inhibitRules          []alertingNotify.InhibitRule
	muteTimeIntervals     []alertingNotify.MuteTimeInterval
	timeIntervals         []alertingNotify.TimeInterval
	templates             []alertingTemplates.TemplateDefinition
	rawAlertmanagerConfig []byte
	configHash            [16]byte

	receivers                []*alertingNotify.APIReceiver
	receiverIntegrationsFunc func(r *alertingNotify.APIReceiver, tmpl *alertingTemplates.Template) ([]*alertingNotify.Integration, error)
}

func (a AlertingConfiguration) BuildReceiverIntegrationsFunc() func(next *alertingNotify.APIReceiver, tmpl *alertingTemplates.Template) ([]*alertingNotify.Integration, error) {
	return func(next *alertingNotify.APIReceiver, tmpl *alertingTemplates.Template) ([]*alertingNotify.Integration, error) {
		return a.receiverIntegrationsFunc(next, tmpl)
	}
}

func (a AlertingConfiguration) DispatcherLimits() alertingNotify.DispatcherLimits {
	return &nilLimits{}
}

func (a AlertingConfiguration) InhibitRules() []alertingNotify.InhibitRule {
	return a.inhibitRules
}

func (a AlertingConfiguration) MuteTimeIntervals() []alertingNotify.MuteTimeInterval {
	return a.muteTimeIntervals
}

func (a AlertingConfiguration) TimeIntervals() []alertingNotify.TimeInterval {
	return a.timeIntervals
}

func (a AlertingConfiguration) Receivers() []*alertingNotify.APIReceiver {
	return a.receivers
}

func (a AlertingConfiguration) RoutingTree() *alertingNotify.Route {
	return a.route
}

func (a AlertingConfiguration) Templates() []alertingTemplates.TemplateDefinition {
	return a.templates
}

func (a AlertingConfiguration) Hash() [16]byte {
	return a.configHash
}

func (a AlertingConfiguration) Raw() []byte {
	return a.rawAlertmanagerConfig
}
