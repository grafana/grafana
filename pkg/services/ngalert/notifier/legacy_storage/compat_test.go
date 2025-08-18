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
	notifytest.ForEachIntegrationTypeReceiver(t, func(configType reflect.Type, receiver notify.ConfigReceiver, rawConfig string) {
		t.Run(configType.Name(), func(t *testing.T) {
			integrations, err := PostableMimirReceiverToIntegrations(receiver)
			require.NoError(t, err)
			require.Len(t, integrations, 1)
			integration := integrations[0]
			assert.Equal(t, "v0", integration.Config.Version)
			assert.Equal(t, strings.ToLower(configType.Name()), integration.Config.Type+"config")

			rawSettings, err := definition.MarshalJSONWithSecrets(integration.Settings)
			require.NoError(t, err)
			assert.JSONEq(t, rawConfig, string(rawSettings))
		})
	})
}
