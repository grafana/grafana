package channels

import (
	"context"
	"encoding/json"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func TestAlertmanagerNotifier(t *testing.T) {
	tmpl := templateForTests(t)

	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	cases := []struct {
		name         string
		settings     string
		alerts       []*types.Alert
		expInitError error
		expMsgError  error
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
		}, {
			name:         "Error in initing: missing URL",
			settings:     `{}`,
			expInitError: alerting.ValidationError{Reason: "Could not find url property in settings"},
		}, {
			name: "Error in initing: invalid URL",
			settings: `{
				"url": "://alertmanager.com"
			}`,
			expInitError: alerting.ValidationError{Reason: "Invalid url property in settings"},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			settingsJSON, err := simplejson.NewJson([]byte(c.settings))
			require.NoError(t, err)

			m := &NotificationChannelConfig{
				Name:     "Alertmanager",
				Type:     "alertmanager",
				Settings: settingsJSON,
			}

			sn, err := NewAlertmanagerNotifier(m, tmpl)
			if c.expInitError != nil {
				require.Error(t, err)
				require.Equal(t, c.expInitError, err)
				return
			}
			require.NoError(t, err)

			var body []byte
			origSendHTTPRequest := sendHTTPRequest
			t.Cleanup(func() {
				sendHTTPRequest = origSendHTTPRequest
			})
			sendHTTPRequest = func(ctx context.Context, url *url.URL, cfg httpCfg, logger log.Logger) ([]byte, error) {
				body = cfg.body
				return nil, nil
			}

			ctx := notify.WithGroupKey(context.Background(), "alertname")
			ctx = notify.WithGroupLabels(ctx, model.LabelSet{"alertname": ""})
			ok, err := sn.Notify(ctx, c.alerts...)
			if c.expMsgError != nil {
				require.False(t, ok)
				require.Error(t, err)
				require.Equal(t, c.expMsgError, err)
				return
			}
			require.NoError(t, err)
			require.True(t, ok)

			expBody, err := json.Marshal(c.alerts)
			require.NoError(t, err)

			require.JSONEq(t, string(expBody), string(body))
		})
	}
}
