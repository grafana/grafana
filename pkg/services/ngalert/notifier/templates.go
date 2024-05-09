package notifier

import (
	"context"
	"fmt"
	"text/template"

	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/templates"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	prometheusModel "github.com/prometheus/common/model"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

type TestTemplatesResults = alertingNotify.TestTemplatesResults

var (
	DefaultLabels = map[string]string{
		prometheusModel.AlertNameLabel:  `alert title`,
		alertingModels.FolderTitleLabel: `folder title`,
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
		addDefaultLabelsAndAnnotations(alert)
	}

	return am.Base.TestTemplate(ctx, alertingNotify.TestTemplatesConfigBodyParams{
		Alerts:   c.Alerts,
		Template: c.Template,
		Name:     c.Name,
	})
}

// addDefaultLabelsAndAnnotations is a slimmed down version of state.StateToPostableAlert and state.GetRuleExtraLabels using default values.
func addDefaultLabelsAndAnnotations(alert *amv2.PostableAlert) {
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

func ParseTemplateGroup(t string) ([]*template.Template, error) {
	u := fmt.Sprintf("__ignore_me_%s", util.GenerateShortUID())
	tmpl, err := template.New(u).Funcs(template.FuncMap(templates.DefaultFuncs)).Parse(t)
	if err != nil {
		return nil, err
	}

	// definedTmpls is the list of all named templates in tmpl, including tmpl.
	definedTmpls := tmpl.Templates()
	result := make([]*template.Template, 0, len(definedTmpls)-1)
	for _, definedTmpl := range definedTmpls {
		if definedTmpl.Name() == u {
			continue
		}
		result = append(result, definedTmpl)
	}
	return result, nil
}
