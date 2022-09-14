package channels

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestTelegramNotifier(t *testing.T) {
	tmpl := templateForTests(t)
	images := newFakeImageStoreWithFile(t, 2)
	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       map[string]string
		expInitError string
		expMsgError  error
	}{
		{
			name: "A single alert with default template",
			settings: `{
				"bottoken": "abcdefgh0123456789",
				"chatid": "someid"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:       model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations:  model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertImageToken__": "test-image-1"},
						GeneratorURL: "a URL",
					},
				},
			},
			expMsg: map[string]string{
				"parse_mode": "html",
				"text":       "**Firing**\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: a URL\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\nDashboard: http://localhost/d/abcd\nPanel: http://localhost/d/abcd?viewPanel=efgh\n",
			},
			expMsgError: nil,
		}, {
			name: "Multiple alerts with custom template",
			settings: `{
				"bottoken": "abcdefgh0123456789",
				"chatid": "someid",
				"message": "__Custom Firing__\n{{len .Alerts.Firing}} Firing\n{{ template \"__text_alert_list\" .Alerts.Firing }}"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:       model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations:  model.LabelSet{"ann1": "annv1", "__alertImageToken__": "test-image-1"},
						GeneratorURL: "a URL",
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2", "__alertImageToken__": "test-image-2"},
					},
				},
			},
			expMsg: map[string]string{
				"parse_mode": "html",
				"text":       "__Custom Firing__\n2 Firing\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val1\nAnnotations:\n - ann1 = annv1\nSource: a URL\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1\n\nValue: [no value]\nLabels:\n - alertname = alert1\n - lbl1 = val2\nAnnotations:\n - ann1 = annv2\nSilence: http://localhost/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2\n",
			},
			expMsgError: nil,
		}, {
			name: "Truncate long message",
			settings: `{
				"bottoken": "abcdefgh0123456789",
				"chatid": "someid",
				"message": "{{ .CommonLabels.alertname }}"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels: model.LabelSet{"alertname": model.LabelValue(strings.Repeat("1", 4097))},
					},
				},
			},
			expMsg: map[string]string{
				"parse_mode": "html",
				"text":       strings.Repeat("1", 4096-3) + "...",
			},
			expMsgError: nil,
		}, {
			name:         "Error in initing",
			settings:     `{}`,
			expInitError: `could not find Bot Token in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)
			secureSettings := make(map[string][]byte)

			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			notificationService := mockNotificationService()

			fc := FactoryConfig{
				Config: &NotificationChannelConfig{
					Name:           "telegram_tests",
					Type:           "telegram",
					Settings:       settingsJSON,
					SecureSettings: secureSettings,
				},
				ImageStore:          images,
				NotificationService: notificationService,
				DecryptFunc:         decryptFn,
			}

			cfg, err := NewTelegramConfig(fc.Config, decryptFn)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			n := NewTelegramNotifier(cfg, images, notificationService, tmpl)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := n.Notify(ctx, c.alerts...)
			require.NoError(t, err)
			require.True(t, ok)

			msg, err := n.buildTelegramMessage(ctx, c.alerts)
			if c.expMsgError != nil {
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.Equal(t, c.expMsg, msg)
		})
	}
}
