package channels

import (
	"context"
	"encoding/json"
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
	"github.com/grafana/grafana/pkg/setting"
)

func TestGoogleChatNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       *outerStruct
		expInitError string
		expMsgError  error
	}{
		{
			name:     "One alert",
			settings: `{"url": "http://localhost"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: &outerStruct{
				PreviewText:  "[FIRING:1]  (val1)",
				FallbackText: "[FIRING:1]  (val1)",
				Cards: []card{
					{
						Header: header{
							Title: "[FIRING:1]  (val1)",
						},
						Sections: []section{
							{
								Widgets: []widget{
									textParagraphWidget{
										Text: text{
											Text: "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
										},
									},
									buttonWidget{
										Buttons: []button{
											{
												TextButton: textButton{
													Text: "OPEN IN GRAFANA",
													OnClick: onClick{
														OpenLink: openLink{
															URL: "http://localhost/alerting/list",
														},
													},
												},
											},
										},
									},
									textParagraphWidget{
										Text: text{
											// RFC822 only has the minute, hence it works in most cases.
											Text: "Grafana v" + setting.BuildVersion + " | " + (time.Now()).Format(time.RFC822),
										},
									},
								},
							},
						},
					},
				},
			},
			expMsgError: nil,
		}, {
			name:     "Multiple alerts",
			settings: `{"url": "http://localhost"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2"},
					},
				},
			},
			expMsg: &outerStruct{
				PreviewText:  "[FIRING:2]  ",
				FallbackText: "[FIRING:2]  ",
				Cards: []card{
					{
						Header: header{
							Title: "[FIRING:2]  ",
						},
						Sections: []section{
							{
								Widgets: []widget{
									textParagraphWidget{
										Text: text{
											Text: "**Firing**\n\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1\n\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval2\n",
										},
									},
									buttonWidget{
										Buttons: []button{
											{
												TextButton: textButton{
													Text: "OPEN IN GRAFANA",
													OnClick: onClick{
														OpenLink: openLink{
															URL: "http://localhost/alerting/list",
														},
													},
												},
											},
										},
									},
									textParagraphWidget{
										Text: text{
											Text: "Grafana v" + setting.BuildVersion + " | " + (time.Now()).Format(time.RFC822),
										},
									},
								},
							},
						},
					},
				},
			},
			expMsgError: nil,
		}, {
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: `failed to validate receiver "googlechat_testing" of type "googlechat": could not find url property in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "googlechat_testing",
				Type:     "googlechat",
				Settings: settingsJSON,
			}

			pn, err := NewGoogleChatNotifier(m, tmpl)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				body = webhook.Body
				return nil
			})

			if time.Now().Second() == 59 {
				// The notification payload has a time component with a precision
				// of minute. So if we are at the edge of a minute, we delay for 1 second
				// to avoid any flakiness.
				time.Sleep(1 * time.Second)
			}
			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := pn.Notify(ctx, c.alerts...)
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
