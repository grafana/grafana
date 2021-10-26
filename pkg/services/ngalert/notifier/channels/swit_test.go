package channels

import (
	"context"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestSwitNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expHeaders   map[string]string
		expMsg       string
		expInitError string
		expMsgError  error
	}{
		{
			name:     "One alert",
			settings: `{"url": "http://hook.swit.io/channel/123141125123616"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh"},
					},
				},
			},
			expHeaders: map[string]string{
				"Content-Type": "application/json",
				"User-Agent":   "Grafana",
			},
			expMsg:      "{\"text\":\"[FIRING:1]  (val1)\\n\\n**Firing**\\n\\nLabels:\\n - alertname = alert1\\n - lbl1 = val1\\nAnnotations:\\n - ann1 = annv1\\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana\\u0026matchers=alertname%3Dalert1%2Clbl1%3Dval1\\nDashboard: http://localhost/d/abcd\\nPanel: http://localhost/d/abcd?viewPanel=efgh\\n\"}",
			expMsgError: nil,
		}, {
			name:     "Multiple alerts",
			settings: `{"url": "http://hook.swit.io/channel/123141125123616"}`,
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
			expHeaders: map[string]string{
				"Content-Type": "application/json",
				"User-Agent":   "Grafana",
			},
			expMsg:      "{\"text\":\"[FIRING:2]  \\n\\n**Firing**\\n\\nLabels:\\n - alertname = alert1\\n - lbl1 = val1\\nAnnotations:\\n - ann1 = annv1\\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana\\u0026matchers=alertname%3Dalert1%2Clbl1%3Dval1\\n\\nLabels:\\n - alertname = alert1\\n - lbl1 = val2\\nAnnotations:\\n - ann1 = annv2\\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana\\u0026matchers=alertname%3Dalert1%2Clbl1%3Dval2\\n\"}",
			expMsgError: nil,
		}, {
			name:         "url missing",
			settings:     `{}`,
			expInitError: `failed to validate receiver "swit_testing" of type "swit": could not find webhook url in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "swit_testing",
				Type:     "swit",
				Settings: settingsJSON,
			}

			decryptFn := ossencryption.ProvideService().GetDecryptedValue
			pn, err := NewSwitNotifier(m, tmpl, decryptFn)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			body := ""
			var headers map[string]string
			bus.AddHandlerCtx("test", func(ctx context.Context, webhook *models.SendWebhookSync) error {
				body = webhook.Body
				headers = webhook.HttpHeader
				return nil
			})

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

			require.Equal(t, c.expHeaders, headers)
			require.Equal(t, c.expMsg, body)
		})
	}
}
