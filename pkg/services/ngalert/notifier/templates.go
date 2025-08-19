package notifier

import (
	"context"

	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	prometheusModel "github.com/prometheus/common/model"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type TestTemplatesResults = alertingNotify.TestTemplatesResults

var (
	DefaultLabels = map[string]string{
		prometheusModel.AlertNameLabel:  `TestAlert`,
		alertingModels.FolderTitleLabel: `Test Folder`,
	}
	DefaultAnnotations = map[string]string{
		alertingModels.ValuesAnnotation:       `{"B":22,"C":1}`,
		alertingModels.ValueStringAnnotation:  `[ var='B' labels={__name__=go_threads, instance=host.docker.internal:3000, job=grafana} value=22 ], [ var='C' labels={__name__=go_threads, instance=host.docker.internal:3000, job=grafana} value=1 ]`,
		alertingModels.OrgIDAnnotation:        `1`,
		alertingModels.DashboardUIDAnnotation: `dashboard_uid`,
		alertingModels.PanelIDAnnotation:      `1`,
	}
)

// TestTemplate tests the given template string against the given alerts. Existing templates are used to provide context for the test.
// If an existing template of the same filename as the one being tested is found, it will not be used as context.
func (am *alertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	for _, alert := range c.Alerts {
		AddDefaultLabelsAndAnnotations(alert)
	}

	return am.Base.TestTemplate(ctx, alertingNotify.TestTemplatesConfigBodyParams{
		Alerts:   c.Alerts,
		Template: c.Template,
		Name:     c.Name,
	})
}

// AddDefaultLabelsAndAnnotations is a slimmed down version of state.StateToPostableAlert and state.GetRuleExtraLabels using default values.
func AddDefaultLabelsAndAnnotations(alert *amv2.PostableAlert) {
	if alert.Labels == nil {
		alert.Labels = make(map[string]string)
	}
	for k, v := range DefaultLabels {
		if _, ok := alert.Labels[k]; !ok {
			alert.Labels[k] = v
		}
	}

	if alert.Annotations == nil {
		alert.Annotations = make(map[string]string)
	}
	for k, v := range DefaultAnnotations {
		if _, ok := alert.Annotations[k]; !ok {
			alert.Annotations[k] = v
		}
	}
}
