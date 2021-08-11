package channels

import (
	"context"
	"net/url"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

type AlertForTest struct {
	request  types.Alert
	response string
	err      error
}

func TestOpsgenieNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []AlertForTest
		expInitError string
	}{
		{
			name:     "Default config with one alert",
			settings: `{"apiKey": "abcdefgh0123456789"}`,
			alerts: []AlertForTest{
				{
					request: types.Alert{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
							Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
						},
					},
					response: `{
						"alias": "024d7322cb7c3e6b385f64344116c6643dcb6f7b0c7c6f30d13a7e8bdd7b8f85",
						"description": "[FIRING:1]  (val1)\nhttp://localhost/alerting/list\n\n**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
						"details": {
							"url": "http://localhost/alerting/list"
						},
						"message": "[FIRING:1]  (val1)",
						"source": "Grafana",
						"tags": ["alertname:alert1", "lbl1:val1"]
					}`,
					err: nil,
				},
			},
		},
		{
			name: "Default config with one alert and send tags as tags",
			settings: `{
				"apiKey": "abcdefgh0123456789",
				"sendTagsAs": "tags"
			}`,
			alerts: []AlertForTest{
				{
					request: types.Alert{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
							Annotations: model.LabelSet{"ann1": "annv1"},
						},
					},
					response: `{
						"alias": "024d7322cb7c3e6b385f64344116c6643dcb6f7b0c7c6f30d13a7e8bdd7b8f85",
						"description": "[FIRING:1]  (val1)\nhttp://localhost/alerting/list\n\n**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n",
						"details": {
							"url": "http://localhost/alerting/list"
						},
						"message": "[FIRING:1]  (val1)",
						"source": "Grafana",
						"tags": ["alertname:alert1", "lbl1:val1"]
					}`,
				},
			},
		},
		{
			name: "Default config with one alert and send tags as details",
			settings: `{
				"apiKey": "abcdefgh0123456789",
				"sendTagsAs": "details"
			}`,
			alerts: []AlertForTest{
				{
					request: types.Alert{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
							Annotations: model.LabelSet{"ann1": "annv1"},
						},
					},
					response: `{
						"alias": "024d7322cb7c3e6b385f64344116c6643dcb6f7b0c7c6f30d13a7e8bdd7b8f85",
						"description": "[FIRING:1]  (val1)\nhttp://localhost/alerting/list\n\n**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n",
						"details": {
							"alertname": "alert1",
							"lbl1": "val1",
							"url": "http://localhost/alerting/list"
						},
						"message": "[FIRING:1]  (val1)",
						"source": "Grafana",
						"tags": []
					}`,
				},
			},
		},
		{
			name: "Custom config with multiple alerts and send tags as both details and tag",
			settings: `{
				"apiKey": "abcdefgh0123456789",
				"sendTagsAs": "both"
			}`,
			alerts: []AlertForTest{
				{
					request: types.Alert{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
							Annotations: model.LabelSet{"ann1": "annv1"},
						},
					},
					response: `{
						"alias": "024d7322cb7c3e6b385f64344116c6643dcb6f7b0c7c6f30d13a7e8bdd7b8f85",
						"description": "[FIRING:1]  (val1)\nhttp://localhost/alerting/list\n\n**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n",
						"details": {
							"alertname": "alert1",
							"url": "http://localhost/alerting/list",
							"lbl1": "val1"
						},
						"message": "[FIRING:1]  (val1)",
						"source": "Grafana",
						"tags": ["alertname:alert1", "lbl1:val1"]
					}`,
				},
				{
					request: types.Alert{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
							Annotations: model.LabelSet{"ann1": "annv1"},
						},
					},
					response: `{
						"alias": "d463d365cd6017b8690203ceb675000ed671756718f4e48bf42a647300a56b63",
						"description": "[FIRING:1]  (val2)\nhttp://localhost/alerting/list\n\n**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval2\n",
						"details": {
							"alertname": "alert1",
							"url": "http://localhost/alerting/list",
							"lbl1": "val2"
						},
						"message": "[FIRING:1]  (val2)",
						"source": "Grafana",
						"tags": ["alertname:alert1", "lbl1:val2"]
					}`,
				},
			},
		},
		{
			name:     "Resolved is not sent when auto close is false",
			settings: `{"apiKey": "abcdefgh0123456789", "autoClose": false}`,
			alerts: []AlertForTest{
				{
					request: types.Alert{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
							Annotations: model.LabelSet{"ann1": "annv1"},
							EndsAt:      time.Now().Add(-1 * time.Minute),
						},
					},
				},
			},
		},
		{
			name:         "Error when incorrect settings",
			settings:     `{}`,
			expInitError: `failed to validate receiver "opsgenie_testing" of type "opsgenie": could not find api key property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "opsgenie_testing",
				Type:     "opsgenie",
				Settings: settingsJSON,
			}

			pn, err := NewOpsgenieNotifier(m, tmpl)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			bodies := []string{}
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				bodies = append(bodies, webhook.Body)
				return nil
			})

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})

			alerts := []*types.Alert{}
			for _, alert := range c.alerts {
				copiedAlert := alert.request
				alerts = append(alerts, &copiedAlert)
			}

			_, errs := pn.NotifyMultiple(ctx, alerts)

			expectedBodies := []string{}
			for _, alert := range c.alerts {
				if alert.response != "" {
					expectedBodies = append(expectedBodies, alert.response)
				}
			}

			// Checking bodies
			for index, value := range bodies {
				require.JSONEq(t, expectedBodies[index], value)
			}

			// Checking errors
			for index, alert := range c.alerts {
				if alert.err != nil {
					require.Error(t, err)
					require.Equal(t, err.Error(), errs[index].Error())
					return
				}
				require.NoError(t, err)
			}
		})
	}
}
