package legacy_storage

import (
	"reflect"
	"strings"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostableMimirReceiverToIntegrations(t *testing.T) {
	t.Run("can convert all known types", func(t *testing.T) {
		notifytest.ForEachIntegrationTypeReceiver(t, func(configType reflect.Type, receiver notify.ConfigReceiver, rawConfig string) {
			t.Run(configType.Name(), func(t *testing.T) {
				integrations, err := PostableMimirReceiverToIntegrations(receiver)
				require.NoError(t, err)
				require.Len(t, integrations, 1)
				integration := integrations[0]
				expectedVersion := "v0mimir1"
				expectedType := strings.ToLower(strings.TrimSuffix(configType.Name(), "Config"))
				if configType.Name() == "MSTeamsConfig" {
					expectedType = "teams"
				}
				if configType.Name() == "MSTeamsV2Config" {
					expectedType = "teams"
					expectedVersion = "v0mimir2"
				}
				assert.Equal(t, expectedVersion, integration.Config.Version)
				assert.Equal(t, expectedType, integration.Config.Type)

				rawSettings, err := definition.MarshalJSONWithSecrets(integration.Settings)
				require.NoError(t, err)
				assert.JSONEq(t, rawConfig, string(rawSettings))
			})
		})
	})
	t.Run("can convert receiver with all integrations", func(t *testing.T) {
		recv, err := notifytest.GetMimirReceiverWithAllIntegrations()
		require.NoError(t, err)
		integrations, err := PostableMimirReceiverToIntegrations(recv)
		require.NoError(t, err)
		require.Len(t, integrations, len(notifytest.ValidMimirConfigs))
	})
}
