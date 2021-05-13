package channels

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestSensuGoNotifier(t *testing.T) {
	tmpl, err := template.FromGlobs("templates/default.tmpl")
	require.NoError(t, err)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       map[string]interface{}
		expInitError error
		expMsgError  error
	}{
		{
			name:     "Default config with one alert",
			settings: `{"url": "http://sensu-api.local:8080", "apikey": "<apikey>"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"entity": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "alert1",
						"namespace": "default",
					},
				},
				"check": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "rule uid",
						"labels": map[string]string{
							"ruleName": "alert1",
							"ruleUId":  "rule uid",
							// TODO imageUrl
							"ruleURL": "http:/localhost/alerting/list",
						},
					},
					"output":   "\n**Firing**\nLabels:\n - alertname = alert1\n - __alert_rule_uid__ = rule uid\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: \n\n\n\n\n",
					"issued":   time.Now().Unix(),
					"interval": 86400,
					"status":   2,
					"handlers": nil,
				},
				"ruleURL": "http:/localhost/alerting/list",
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name: "Custom config with multiple alerts",
			settings: `{
				"url": "http://sensu-api.local:8080",
				"apikey": "<apikey>",
				"message": "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: map[string]interface{}{
				"entity": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name":      "alert1",
						"namespace": "default",
					},
				},
				"check": map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "rule uid",
						"labels": map[string]string{
							"ruleName": "alert1",
							"ruleUId":  "rule uid",
							// TODO imageUrl
							"ruleURL": "http:/localhost/alerting/list",
						},
					},
					"output":   "2 alerts are firing, 0 are resolved",
					"issued":   time.Now().Unix(),
					"interval": 86400,
					"status":   2,
					"handlers": nil,
				},
				"ruleURL": "http:/localhost/alerting/list",
			},
			expInitError: nil,
			expMsgError:  nil,
		}, {
			name: "Error in initing: missing URL",
			settings: `{
				"apikey": "<apikey>"
			}`,
			expInitError: alerting.ValidationError{Reason: "Could not find URL property in settings"},
		}, {
			name: "Error in initing: missing API key",
			settings: `{
				"url": "http://sensu-api.local:8080"
			}`,
			expInitError: alerting.ValidationError{Reason: "Could not find the API Key property in settings"},
		}, {
			name: "Error in building message",
			settings: `{
				"url": "http://sensu-api.local:8080",
				"apikey": "<apikey>",
				"message": "{{ .Status }"
			}`,
			expMsgError: errors.New("failed to template sensugo message: template: :1: unexpected \"}\" in operand"),
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &models.AlertNotification{
				Name:     "Sensu Go",
				Type:     "sensugo",
				Settings: settingsJSON,
			}

			sn, err := NewSensuGoNotifier(m, tmpl)
			if c.expInitError != nil {
				require.Error(t, err)
				require.Equal(t, c.expInitError.Error(), err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				body = webhook.Body
				return nil
			})

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := sn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), body)
		})
	}
}
