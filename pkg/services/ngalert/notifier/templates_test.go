package notifier

import (
	"context"
	"fmt"
	"testing"
	"time" // LOGZ.IO GRAFANA CHANGE :: DEV-47397 - Append timeframe for panel/dashboard URL

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
	simpleAlert = amv2.PostableAlert{
		Alert: amv2.Alert{
			Labels: amv2.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
		},
		Annotations: amv2.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "test-image-1"},
		StartsAt:    strfmt.DateTime{},
		EndsAt:      strfmt.DateTime{},
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
				Name: "slack.title",
				Text: "\nReceiver: TestReceiver\nStatus: firing\nExternalURL: http://localhost:9093\nAlerts: 1\nFiring Alerts: 1\nResolved Alerts: 0\nGroupLabels: group_label=group_label_value \nCommonLabels: alertname=alert1 grafana_folder=folder title lbl1=val1 \nCommonAnnotations: ann1=annv1 \n",
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
				Name: "slack.title",
				Text: DefaultLabels[prometheusModel.AlertNameLabel],
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
				Name: "slack.title",
				Text: DefaultLabels[alertingModels.FolderTitleLabel],
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
				Name: "slack.title",
				Text: "B=22 C=1 ",
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
				Name: "slack.title",
				Text: DefaultAnnotations[alertingModels.ValueStringAnnotation],
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
				// LOGZ.IO GRAFANA CHANGE :: DEV-45707: remove org id query param from notification urls
				// LOGZ.IO GRAFANA CHANGE :: DEV-47397 - Append timeframe for panel/dashboard URL
				Text: fmt.Sprintf("http://localhost:9093/d/%s?from=%d&to=%d",
					DefaultAnnotations[alertingModels.DashboardUIDAnnotation],
					time.Time(simpleAlert.StartsAt).Add(-5*time.Minute).UnixMilli(),
					time.Time(simpleAlert.EndsAt).UnixMilli()),
				// LOGZ.IO GRAFANA CHANGE :: End
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
				// LOGZ.IO GRAFANA CHANGE :: DEV-45707: remove org id query param from notification urls
				// LOGZ.IO GRAFANA CHANGE :: DEV-47397 - Append timeframe for panel/dashboard URL
				Text: fmt.Sprintf("http://localhost:9093/d/%s?viewPanel=%s&from=%d&to=%d",
					DefaultAnnotations[alertingModels.DashboardUIDAnnotation],
					DefaultAnnotations[alertingModels.PanelIDAnnotation],
					time.Time(simpleAlert.StartsAt).Add(-5*time.Minute).UnixMilli(),
					time.Time(simpleAlert.EndsAt).UnixMilli()),
				// LOGZ.IO GRAFANA CHANGE :: End
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
				Name: "slack.title",
				Text: "http://localhost:3000", // LOGZ.IO GRAFANA CHANGE :: DEV-45707: remove org id query param from notification urls
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
