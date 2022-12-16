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

	"github.com/grafana/grafana/pkg/setting"
)

func TestGoogleChatNotifier(t *testing.T) {
	constNow := time.Now()
	defer mockTimeNow(constNow)()

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       *outerStruct
		expInitError string
		expMsgError  error
		externalURL  string
	}{
		{
			name:        "One alert",
			settings:    `{"url": "http://localhost"}`,
			externalURL: "http://localhost",
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
											Text: "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
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
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
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
			name:        "Multiple alerts",
			settings:    `{"url": "http://localhost"}`,
			externalURL: "http://localhost",
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
											Text: "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
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
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
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
			externalURL:  "http://localhost",
			expInitError: `could not find url property in settings`,
		}, {
			name:        "Customized message",
			settings:    `{"url": "http://localhost", "message": "I'm a custom template and you have {{ len .Alerts.Firing }} firing alert."}`,
			externalURL: "http://localhost",
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
											Text: "I'm a custom template and you have 1 firing alert.",
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
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
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
			name:        "Customized title",
			settings:    `{"url": "http://localhost", "title": "Alerts firing: {{ len .Alerts.Firing }}"}`,
			externalURL: "http://localhost",
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expMsg: &outerStruct{
				PreviewText:  "Alerts firing: 1",
				FallbackText: "Alerts firing: 1",
				Cards: []card{
					{
						Header: header{
							Title: "Alerts firing: 1",
						},
						Sections: []section{
							{
								Widgets: []widget{
									textParagraphWidget{
										Text: text{
											Text: "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
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
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
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
			name:        "Missing field in template",
			settings:    `{"url": "http://localhost", "message": "I'm a custom template {{ .NotAField }} bad template"}`,
			externalURL: "http://localhost",
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
											Text: "I'm a custom template ",
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
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
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
			name:        "Invalid template",
			settings:    `{"url": "http://localhost", "message": "I'm a custom template {{ {.NotAField }} bad template"}`,
			externalURL: "http://localhost",
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
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
										},
									},
								},
							},
						},
					},
				},
			},
			expMsgError: nil,
		},
		{
			name:        "Empty external URL",
			settings:    `{ "url": "http://localhost" }`, // URL in settings = googlechat url
			externalURL: "",                              // external URL = URL of grafana from configuration
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
											Text: "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\n",
										},
									},

									// No button widget here since the external URL is not absolute

									textParagraphWidget{
										Text: text{
											// RFC822 only has the minute, hence it works in most cases.
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name:        "Relative external URL",
			settings:    `{ "url": "http://localhost" }`, // URL in settings = googlechat url
			externalURL: "/grafana",                      // external URL = URL of grafana from configuration
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
											Text: "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSilence: /grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: /grafana/d/abcd\nPanel: /grafana/d/abcd?viewPanel=efgh\n",
										},
									},

									// No button widget here since the external URL is not absolute

									textParagraphWidget{
										Text: text{
											// RFC822 only has the minute, hence it works in most cases.
											Text: "Grafana v" + setting.BuildVersion + " | " + constNow.Format(time.RFC822),
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			tmpl := templateForTests(t)

			externalURL, err := url.Parse(c.externalURL)
			require.NoError(t, err)
			tmpl.ExternalURL = externalURL

			webhookSender := mockNotificationService()
			imageStore := &UnavailableImageStore{}

			fc := FactoryConfig{
				Config: &NotificationChannelConfig{
					Name:     "googlechat_testing",
					Type:     "googlechat",
					Settings: json.RawMessage(c.settings),
				},
				ImageStore:          imageStore,
				NotificationService: webhookSender,
				Template:            tmpl,
				Logger:              &FakeLogger{},
			}

			pn, err := newGoogleChatNotifier(fc)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

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

			require.NotEmpty(t, webhookSender.Webhook.Url)

			expBody, err := json.Marshal(c.expMsg)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), webhookSender.Webhook.Body)
		})
	}
}
