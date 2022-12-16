package channels

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestNewAlertmanagerNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name              string
		settings          string
		alerts            []*types.Alert
		expectedInitError string
		receiverName      string
	}{
		{
			name:              "Error in initing: missing URL",
			settings:          `{}`,
			expectedInitError: `could not find url property in settings`,
		}, {
			name: "Error in initing: invalid URL",
			settings: `{
				"url": "://alertmanager.com"
			}`,
			expectedInitError: `invalid url property in settings: parse "://alertmanager.com/api/v1/alerts": missing protocol scheme`,
			receiverName:      "Alertmanager",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			secureSettings := make(map[string][]byte)

			m := &NotificationChannelConfig{
				Name:           c.receiverName,
				Type:           "prometheus-alertmanager",
				Settings:       json.RawMessage(c.settings),
				SecureSettings: secureSettings,
			}

			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			cfg, err := NewAlertmanagerConfig(m, decryptFn)
			if c.expectedInitError != "" {
				require.Equal(t, c.expectedInitError, err.Error())
				return
			}
			require.NoError(t, err)
			sn := NewAlertmanagerNotifier(cfg, &FakeLogger{}, &UnavailableImageStore{}, tmpl, decryptFn)
			require.NotNil(t, sn)
		})
	}
}

func TestAlertmanagerNotifier_Notify(t *testing.T) {
	tmpl := templateForTests(t)

	images := newFakeImageStore(1)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name                 string
		settings             string
		alerts               []*types.Alert
		expectedError        string
		sendHTTPRequestError error
		receiverName         string
	}{
		{
			name:     "Default config with one alert",
			settings: `{"url": "https://alertmanager.com"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			receiverName: "Alertmanager",
		}, {
			name:     "Default config with one alert with image URL",
			settings: `{"url": "https://alertmanager.com"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1"},
						Annotations: model.LabelSet{"__alertImageToken__": "test-image-1"},
					},
				},
			},
			receiverName: "Alertmanager",
		}, {
			name:     "Default config with one alert with empty receiver name",
			settings: `{"url": "https://alertmanager.com"}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
		}, {
			name: "Error sending to Alertmanager",
			settings: `{
				"url": "https://alertmanager.com"
			}`,
			alerts: []*types.Alert{
				{
					Alert: model.Alert{
						Labels:      model.LabelSet{"__alert_rule_uid__": "rule uid", "alertname": "alert1", "lbl1": "val1"},
						Annotations: model.LabelSet{"ann1": "annv1"},
					},
				},
			},
			expectedError:        "failed to send alert to Alertmanager: expected error",
			sendHTTPRequestError: errors.New("expected error"),
			receiverName:         "Alertmanager",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON := json.RawMessage(c.settings)
			require.NoError(t, err)
			secureSettings := make(map[string][]byte)

			m := &NotificationChannelConfig{
				Name:           c.receiverName,
				Type:           "prometheus-alertmanager",
				Settings:       settingsJSON,
				SecureSettings: secureSettings,
			}

			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			cfg, err := NewAlertmanagerConfig(m, decryptFn)
			require.NoError(t, err)
			sn := NewAlertmanagerNotifier(cfg, &FakeLogger{}, images, tmpl, decryptFn)
			var body []byte
			origSendHTTPRequest := sendHTTPRequest
			t.Cleanup(func() {
				sendHTTPRequest = origSendHTTPRequest
			})
			sendHTTPRequest = func(ctx context.Context, url *url.URL, cfg httpCfg, logger Logger) ([]byte, error) {
				body = cfg.body
				return nil, c.sendHTTPRequestError
			}

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := sn.Notify(ctx, c.alerts...)

			if c.sendHTTPRequestError != nil {
				require.EqualError(t, err, c.expectedError)
				require.False(t, ok)
			} else {
				require.NoError(t, err)
				require.True(t, ok)
				expBody, err := json.Marshal(c.alerts)
				require.NoError(t, err)
				require.JSONEq(t, string(expBody), string(body))
			}
		})
	}
}
