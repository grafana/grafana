package v1

import (
	"encoding/json"
	"testing"

	"github.com/grafana/alerting/definition/compat"
	"github.com/grafana/alerting/http/v0mimir/v0mimirtest"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/prometheus/alertmanager/config"
	commoncfg "github.com/prometheus/common/config"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

// unsupportedReceiversFromError reads the receiver list from the error's "extra".
func unsupportedReceiversFromError(t *testing.T, err error) []unsupportedReceiverFields {
	t.Helper()
	var gErr errutil.Error
	require.ErrorAs(t, err, &gErr)
	require.Equal(t, "alerting.unsupportedReceiverFields", gErr.MessageID)
	receivers, ok := gErr.Public().Extra["receivers"].([]unsupportedReceiverFields)
	require.True(t, ok, "expected Receivers in error extra payload")
	return receivers
}

// TestUnsupportedReceiverFieldsError_JSONShape pins the public API response shape.
func TestUnsupportedReceiverFieldsError_JSONShape(t *testing.T) {
	err := errUnsupportedReceiverFields([]unsupportedReceiverFields{
		{Receiver: "a", Fields: []string{"email_configs[0].auth_password_file"}},
	})

	var gErr errutil.Error
	require.ErrorAs(t, err, &gErr)

	out, mErr := json.Marshal(gErr.Public())
	require.NoError(t, mErr)
	require.JSONEq(t, `{
		"statusCode": 400,
		"messageId": "alerting.unsupportedReceiverFields",
		"message": "Configuration contains receivers that cannot be converted to Grafana receivers",
		"extra": {"receivers": [{"receiver": "a", "fields": ["email_configs[0].auth_password_file"]}]}
	}`, string(out))
}

func TestFindUnsupportedReceiverFields_FlagsRemovedFields(t *testing.T) {
	testCases := []struct {
		name     string
		receiver config.Receiver
		wantPath string
	}{
		{
			name: "email auth_password_file",
			receiver: config.Receiver{
				Name:         "email",
				EmailConfigs: []*config.EmailConfig{{AuthPasswordFile: "/etc/smtp-password"}},
			},
			wantPath: "email_configs[0].auth_password_file",
		},
		{
			name: "slack api_url_file",
			receiver: config.Receiver{
				Name:         "slack",
				SlackConfigs: []*config.SlackConfig{{APIURLFile: "/etc/slack-url"}},
			},
			wantPath: "slack_configs[0].api_url_file",
		},
		{
			name: "webhook url_file",
			receiver: config.Receiver{
				Name:           "webhook",
				WebhookConfigs: []*config.WebhookConfig{{URLFile: "/etc/webhook-url"}},
			},
			wantPath: "webhook_configs[0].url_file",
		},
		{
			name: "webhook tls cert_file in shared http config",
			receiver: config.Receiver{
				Name: "webhook-tls",
				WebhookConfigs: []*config.WebhookConfig{{
					HTTPConfig: &commoncfg.HTTPClientConfig{
						TLSConfig: commoncfg.TLSConfig{CertFile: "/etc/cert.pem"},
					},
				}},
			},
			wantPath: "webhook_configs[0].http_config.tls_config.cert_file",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			def := compat.UpstreamReceiverToDefinitionReceiver(tc.receiver)
			fields, err := findUnsupportedReceiverFields(tc.receiver, def)
			require.NoError(t, err)
			require.Contains(t, fields, tc.wantPath)
		})
	}
}

// TestFindUnsupportedReceiverFields_NoFalsePositives: every supported field must
// survive the round-trip. We build a receiver with all integration types for each
// available HTTP-config variant (basic_auth, oauth2, tls, headers, proxy, ...) so
// the shared http_config sub-struct is exercised too, and assert nothing is
// reported.
func TestFindUnsupportedReceiverFields_NoFalsePositives(t *testing.T) {
	for opt := range v0mimirtest.ValidMimirHTTPConfigs {
		t.Run(string(opt), func(t *testing.T) {
			def, err := notifytest.GetMimirReceiverWithAllIntegrations(opt)
			require.NoError(t, err)

			upstream := compat.DefinitionReceiverToUpstreamReceiver(def)
			fields, err := findUnsupportedReceiverFields(upstream, compat.UpstreamReceiverToDefinitionReceiver(upstream))
			require.NoError(t, err)
			require.Empty(t, fields, "supported fields must not be reported as unsupported")
		})
	}
}

func TestExtraConfiguration_Validate_RejectsUnsupportedFields(t *testing.T) {
	t.Run("rejects unsupported field and names it", func(t *testing.T) {
		ec := ExtraConfiguration{
			Identifier: "test",
			AlertmanagerConfig: `
global:
  smtp_smarthost: 'localhost:25'
  smtp_from: 'alerts@example.com'
route:
  receiver: a
receivers:
  - name: a
    email_configs:
      - to: someone@example.com
        auth_password_file: /etc/smtp-password
`,
		}
		err := ec.Validate()
		require.Error(t, err)
		require.Equal(t, []unsupportedReceiverFields{
			{Receiver: "a", Fields: []string{"email_configs[0].auth_password_file"}},
		}, unsupportedReceiversFromError(t, err))
	})

	t.Run("reports unsupported fields from all receivers", func(t *testing.T) {
		ec := ExtraConfiguration{
			Identifier: "test",
			AlertmanagerConfig: `
global:
  smtp_smarthost: 'localhost:25'
  smtp_from: 'alerts@example.com'
route:
  receiver: a
receivers:
  - name: a
    email_configs:
      - to: someone@example.com
        auth_password_file: /etc/smtp-password
  - name: b
    slack_configs:
      - channel: '#alerts'
        api_url_file: /etc/slack-url
`,
		}
		err := ec.Validate()
		require.Error(t, err)
		require.Equal(t, []unsupportedReceiverFields{
			{Receiver: "a", Fields: []string{"email_configs[0].auth_password_file"}},
			{Receiver: "b", Fields: []string{"slack_configs[0].api_url_file"}},
		}, unsupportedReceiversFromError(t, err))
	})

	t.Run("accepts config without unsupported fields", func(t *testing.T) {
		ec := ExtraConfiguration{
			Identifier: "test",
			AlertmanagerConfig: `
route:
  receiver: a
receivers:
  - name: a
`,
		}
		require.NoError(t, ec.Validate())
	})
}
