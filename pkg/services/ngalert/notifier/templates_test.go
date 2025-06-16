package notifier

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	prometheusModel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var (
	timeNow     = time.Now()
	simpleAlert = amv2.PostableAlert{
		Alert: amv2.Alert{
			Labels: amv2.LabelSet{
				alertingModels.RuleUIDLabel:    "rule uid",
				prometheusModel.AlertNameLabel: "alert1",
				"lbl1":                         "val1",
			},
		},
		Annotations: amv2.LabelSet{
			"ann1":                                "annv1",
			alertingModels.DashboardUIDAnnotation: "abcd",
			alertingModels.PanelIDAnnotation:      "42",
			alertingModels.ImageTokenAnnotation:   "test-image-1",
			alertingModels.OrgIDAnnotation:        "1",
		},
		StartsAt: strfmt.DateTime(timeNow),
		EndsAt:   strfmt.DateTime(timeNow.Add(time.Hour)), // Firing.
	}
	resolvedAlert = amv2.PostableAlert{
		Alert: amv2.Alert{
			Labels: amv2.LabelSet{
				alertingModels.RuleUIDLabel:    "rule uid",
				prometheusModel.AlertNameLabel: "alert1",
				"lbl1":                         "val1",
			},
		},
		Annotations: amv2.LabelSet{
			"ann1":                                "annv1",
			alertingModels.DashboardUIDAnnotation: "abcd",
			alertingModels.PanelIDAnnotation:      "42",
			alertingModels.ImageTokenAnnotation:   "test-image-1",
			alertingModels.OrgIDAnnotation:        "1",
		},
		StartsAt: strfmt.DateTime(timeNow.Add(-30 * time.Minute)),
		EndsAt:   strfmt.DateTime(timeNow), // Resolved.
	}
)

func TestTemplateDefaultData(t *testing.T) {
	am := setupAMTest(t)

	tests := []struct {
		name     string
		input    apimodels.TestTemplatesConfigBodyParams
		expected TestTemplatesResults
	}{{
		name: "check various extended data",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts: []*amv2.PostableAlert{&simpleAlert},
			Name:   "slack.title",
			Template: `{{ define "slack.title" }}
Receiver: {{ .Receiver }}
Status: {{ .Status }}
ExternalURL: {{ .ExternalURL }}
Alerts: {{ len .Alerts }}
Firing Alerts: {{ len .Alerts.Firing }}
Resolved Alerts: {{ len .Alerts.Resolved }}
GroupLabels: {{ range .GroupLabels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
CommonLabels: {{ range .CommonLabels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
CommonAnnotations: {{ range .CommonAnnotations.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  "\nReceiver: TestReceiver\nStatus: firing\nExternalURL: http://localhost:9093\nAlerts: 1\nFiring Alerts: 1\nResolved Alerts: 0\nGroupLabels: group_label=group_label_value \nCommonLabels: alertname=alert1 grafana_folder=Test Folder lbl1=val1 \nCommonAnnotations: ann1=annv1 \n",
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "AlertNameLabel",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{}},
			Name:     "slack.title",
			Template: fmt.Sprintf(`{{ define "slack.title" }}{{ index (index .Alerts 0 ).Labels "%s" }}{{ end }}`, prometheusModel.AlertNameLabel),
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  DefaultLabels[prometheusModel.AlertNameLabel],
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "FolderTitleLabel",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{}},
			Name:     "slack.title",
			Template: fmt.Sprintf(`{{ define "slack.title" }}{{ index (index .Alerts 0 ).Labels "%s" }}{{ end }}`, alertingModels.FolderTitleLabel),
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  DefaultLabels[alertingModels.FolderTitleLabel],
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "ValuesAnnotation",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{}},
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ range $key, $value := (index .Alerts 0 ).Values }}{{ $key }}={{ $value }} {{ end }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  "B=22 C=1 ",
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "ValueStringAnnotation",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{}},
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ (index .Alerts 0 ).ValueString }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  DefaultAnnotations[alertingModels.ValueStringAnnotation],
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "DashboardURL generation contains DashboardUIDAnnotation and OrgIDAnnotation ",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{}},
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ (index .Alerts 0 ).DashboardURL }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name: "slack.title",
				Text: fmt.Sprintf("http://localhost:9093/d/%s?orgId=%s",
					DefaultAnnotations[alertingModels.DashboardUIDAnnotation],
					DefaultAnnotations[alertingModels.OrgIDAnnotation]),
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "PanelURL generation contains DashboardUIDAnnotation, PanelIDAnnotation, and OrgIDAnnotation ",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{}},
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ (index .Alerts 0 ).PanelURL }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name: "slack.title",
				Text: fmt.Sprintf("http://localhost:9093/d/%s?orgId=%s&viewPanel=%s",
					DefaultAnnotations[alertingModels.DashboardUIDAnnotation],
					DefaultAnnotations[alertingModels.OrgIDAnnotation],
					DefaultAnnotations[alertingModels.PanelIDAnnotation]),
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "GeneratorURL generation ",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{{Alert: amv2.Alert{GeneratorURL: "http://localhost:3000"}}},
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ (index .Alerts 0 ).GeneratorURL }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  fmt.Sprintf("http://localhost:3000?orgId=%s", DefaultAnnotations[alertingModels.OrgIDAnnotation]),
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "Alerts scoped templated ",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts: []*amv2.PostableAlert{{Alert: amv2.Alert{GeneratorURL: "http://localhost:3000"}}},
			Name:   "slack.title",
			Template: `{{ define "slack.title" }}
	{{ range . }}
		Status: {{ .Status }}
		Starts at: {{ .StartsAt }}
	{{ end }}
{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  "\n\t\n\t\tStatus: firing\n\t\tStarts at: 0001-01-01 00:00:00 +0000 UTC\n\t\n",
				Scope: alertingNotify.TemplateScope(apimodels.AlertsScope),
			}},
			Errors: nil,
		},
	}, {
		name: "Alert scoped templated ",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts: []*amv2.PostableAlert{{Alert: amv2.Alert{GeneratorURL: "http://localhost:3000"}}},
			Name:   "slack.title",
			Template: `{{ define "slack.title" }}
	Status: {{ .Status }}
	Starts at: {{ .StartsAt }}
{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name:  "slack.title",
				Text:  "\n\tStatus: firing\n\tStarts at: 0001-01-01 00:00:00 +0000 UTC\n",
				Scope: alertingNotify.TemplateScope(apimodels.AlertScope),
			}},
			Errors: nil,
		},
	}, {
		name: "DashboardURL generation contains from and to time",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{&resolvedAlert}, // We specifically use a resolved alert as otherwise the `to` time will be the current time and difficult to test.
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ (index .Alerts 0 ).DashboardURL }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name: "slack.title",
				Text: fmt.Sprintf("http://localhost:9093/d/%s?from=%d&orgId=%s&to=%d",
					resolvedAlert.Annotations[alertingModels.DashboardUIDAnnotation],
					timeNow.Add(-90*time.Minute).UnixMilli(), // StartsAt - 1hr.
					resolvedAlert.Annotations[alertingModels.OrgIDAnnotation],
					timeNow.UnixMilli()),
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	}, {
		name: "PanelURL generation contains from and to time ",
		input: apimodels.TestTemplatesConfigBodyParams{
			Alerts:   []*amv2.PostableAlert{&resolvedAlert}, // We specifically use a resolved alert as otherwise the `to` time will be the current time and difficult to test.
			Name:     "slack.title",
			Template: `{{ define "slack.title" }}{{ (index .Alerts 0 ).PanelURL }}{{ end }}`,
		},
		expected: TestTemplatesResults{
			Results: []alertingNotify.TestTemplatesResult{{
				Name: "slack.title",
				Text: fmt.Sprintf("http://localhost:9093/d/%s?from=%d&orgId=%s&to=%d&viewPanel=%s",
					resolvedAlert.Annotations[alertingModels.DashboardUIDAnnotation],
					timeNow.Add(-90*time.Minute).UnixMilli(), // StartsAt - 1hr.
					resolvedAlert.Annotations[alertingModels.OrgIDAnnotation],
					timeNow.UnixMilli(),
					resolvedAlert.Annotations[alertingModels.PanelIDAnnotation]),
				Scope: alertingNotify.TemplateScope(apimodels.RootScope),
			}},
			Errors: nil,
		},
	},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			res, err := am.TestTemplate(context.Background(), test.input)
			require.NoError(t, err)
			assert.Equal(t, test.expected, *res)
		})
	}
}
