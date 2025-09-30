package legacy_storage

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/teams"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostableMimirReceiverToIntegrations(t *testing.T) {
	t.Run("can convert all known types", func(t *testing.T) {
		notifytest.ForEachIntegrationTypeReceiver(t, func(configType reflect.Type, receiver notify.ConfigReceiver, rawConfig string) {
			expectedType, err := notify.IntegrationTypeFromMimirTypeReflect(configType)
			assert.NoError(t, err)
			expectedVersion := schema.V0mimir1
			if configType.Name() == "MSTeamsConfig" {
				expectedType = teams.Type
			}
			if configType.Name() == "MSTeamsV2Config" {
				expectedType = teams.Type
				expectedVersion = schema.V0mimir2
			}
			t.Run(fmt.Sprintf("%s as %s %s", configType.Name(), expectedType, expectedVersion), func(t *testing.T) {
				integrations, err := PostableMimirReceiverToIntegrations(receiver)
				require.NoError(t, err)
				require.Len(t, integrations, 1)
				integration := integrations[0]
				rawSettings, err := definition.MarshalJSONWithSecrets(integration.Settings)
				require.NoError(t, err)

				assert.EqualValues(t, expectedVersion, integration.Config.Version)
				assert.EqualValues(t, expectedType, integration.Config.Type())
				assert.JSONEq(t, rawConfig, string(rawSettings))
				assert.Empty(t, integration.SecureSettings)
			})
		})
	})

	t.Run("can convert receiver with all integrations", func(t *testing.T) {
		recv, err := notifytest.GetMimirReceiverWithAllIntegrations()
		require.NoError(t, err)
		integrations, err := PostableMimirReceiverToIntegrations(recv)
		require.NoError(t, err)
		require.Len(t, integrations, len(notifytest.AllValidMimirConfigs))
	})

	t.Run("returns empty if receiver has no integrations", func(t *testing.T) {
		integrations, err := PostableMimirReceiverToIntegrations(notify.ConfigReceiver{Name: "test"})
		require.NoError(t, err)
		require.Empty(t, integrations)
	})
}
