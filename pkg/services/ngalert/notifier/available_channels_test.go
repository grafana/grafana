package notifier

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSecureOptionsAreProvisioningReady(t *testing.T) {
	secureOptions := map[string][]string{}
	var count int
	for _, n := range GetAvailableNotifiers() {
		for _, option := range n.Options {
			if option.Secure {
				count++
				_, ok := secureOptions[n.Name]
				if !ok {
					secureOptions[n.Name] = []string{}
				}
				secureOptions[n.Name] = append(secureOptions[n.Name], option.PropertyName)
			}
		}
	}

	// If a new secure setting is added it must also be added in pkg/services/ngalert/api/tooling/definitions/provisioning_contactpoints.go,
	// this whole test can be removed once https://github.com/grafana/grafana/pull/52527 is merged.
	require.Equal(t, 14, count)
	expectedSecureOptionsByReceiver := map[string][]string{
		"Alertmanager":    {"basicAuthPassword"},
		"LINE":            {"token"},
		"OpsGenie":        {"apiKey"},
		"PagerDuty":       {"integrationKey"},
		"Pushover":        {"apiToken", "userKey"},
		"Sensu Go":        {"apikey"},
		"Slack":           {"token", "url"},
		"Telegram":        {"bottoken"},
		"Threema Gateway": {"api_secret"},
		"WeCom":           {"url"},
		"Webhook":         {"password", "authorization_credentials"}}

	require.True(t, reflect.DeepEqual(expectedSecureOptionsByReceiver, secureOptions))
}
