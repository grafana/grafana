package channels

import (
	"context"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestThreemaNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	images := newFakeImageStore(2)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expMsg       string
		expInitError string
		expMsgError  error
	}{
		{
			name: "A single alert with an image",
			settings: `{
				"gateway_id": "*1234567",
				"recipient_id": "87654321",
				"api_secret": "supersecret"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__dashboardUid__": "abcd", "__panelId__": "efgh", "__alertScreenshotToken__": "test-image-1"},
					},
				},
			},
			expMsg:      "from=%2A1234567&secret=supersecret&text=%E2%9A%A0%EF%B8%8F+%5BFIRING%3A1%5D++%28val1%29%0A%0A%2AMessage%3A%2A%0A%2A%2AFiring%2A%2A%0A%0AValue%3A+%5Bno+value%5D%0ALabels%3A%0A+-+alertname+%3D+alert1%0A+-+lbl1+%3D+val1%0AAnnotations%3A%0A+-+ann1+%3D+annv1%0ASilence%3A+http%3A%2F%2Flocalhost%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matcher%3Dalertname%253Dalert1%26matcher%3Dlbl1%253Dval1%0ADashboard%3A+http%3A%2F%2Flocalhost%2Fd%2Fabcd%0APanel%3A+http%3A%2F%2Flocalhost%2Fd%2Fabcd%3FviewPanel%3Defgh%0A%0A%2AURL%3A%2A+http%3A%2Flocalhost%2Falerting%2Flist%0A%2AImage%3A%2A+https%3A%2F%2Fwww.example.com%2Ftest-image-1.jpg%0A&to=87654321",
			expMsgError: nil,
		}, {
			name: "Multiple alerts with images",
			settings: `{
				"gateway_id": "*1234567",
				"recipient_id": "87654321",
				"api_secret": "supersecret"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1", "__alertScreenshotToken__": "test-image-1"},
					},
				}, {
					Alert: model.Alert{
						Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
						Annotations: model.LabelSet{"ann1": "annv2", "__alertScreenshotToken__": "test-image-2"},
					},
				},
			},
			expMsg:      "from=%2A1234567&secret=supersecret&text=%E2%9A%A0%EF%B8%8F+%5BFIRING%3A2%5D++%0A%0A%2AMessage%3A%2A%0A%2A%2AFiring%2A%2A%0A%0AValue%3A+%5Bno+value%5D%0ALabels%3A%0A+-+alertname+%3D+alert1%0A+-+lbl1+%3D+val1%0AAnnotations%3A%0A+-+ann1+%3D+annv1%0ASilence%3A+http%3A%2F%2Flocalhost%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matcher%3Dalertname%253Dalert1%26matcher%3Dlbl1%253Dval1%0A%0AValue%3A+%5Bno+value%5D%0ALabels%3A%0A+-+alertname+%3D+alert1%0A+-+lbl1+%3D+val2%0AAnnotations%3A%0A+-+ann1+%3D+annv2%0ASilence%3A+http%3A%2F%2Flocalhost%2Falerting%2Fsilence%2Fnew%3Falertmanager%3Dgrafana%26matcher%3Dalertname%253Dalert1%26matcher%3Dlbl1%253Dval2%0A%0A%2AURL%3A%2A+http%3A%2Flocalhost%2Falerting%2Flist%0A%2AImage%3A%2A+https%3A%2F%2Fwww.example.com%2Ftest-image-1.jpg%0A%2AImage%3A%2A+https%3A%2F%2Fwww.example.com%2Ftest-image-2.jpg%0A&to=87654321",
			expMsgError: nil,
		}, {
			name: "Invalid gateway id",
			settings: `{
				"gateway_id": "12345678",
				"recipient_id": "87654321",
				"api_secret": "supersecret"
			}`,
			expInitError: `invalid Threema Gateway ID: Must start with a *`,
		}, {
			name: "Invalid receipent id",
			settings: `{
				"gateway_id": "*1234567",
				"recipient_id": "8765432",
				"api_secret": "supersecret"
			}`,
			expInitError: `invalid Threema Recipient ID: Must be 8 characters long`,
		}, {
			name: "No API secret",
			settings: `{
				"gateway_id": "*1234567",
				"recipient_id": "87654321"
			}`,
			expInitError: `could not find Threema API secret in settings`,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)
			secureSettings := make(map[string][]byte)

			m := &NotificationChannelConfig{
				Name:           "threema_testing",
				Type:           "threema",
				Settings:       settingsJSON,
				SecureSettings: secureSettings,
			}

			webhookSender := mockNotificationService()
			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			cfg, err := NewThreemaConfig(m, decryptFn)
			if c.expInitError != "" {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err.Error())
				return
			}
			require.NoError(t, err)

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			pn := NewThreemaNotifier(cfg, images, webhookSender, tmpl)
			ok, err := pn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError.Error(), err.Error())
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			require.Equal(t, c.expMsg, webhookSender.Webhook.Body)
		})
	}
}
