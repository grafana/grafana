package v0alpha2

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestConvertToK8sResource(t *testing.T) {
	for integrationType, cfg := range notify.AllKnownConfigsForTesting {
		t.Run(integrationType, func(t *testing.T) {
			schema, err := models.IntegrationConfigFromType(integrationType)
			require.NoError(t, err)
			settingsMap := map[string]any{}
			require.NoError(t, json.Unmarshal([]byte(cfg.Config), &settingsMap))
			recCfg := &models.Receiver{
				UID:  fmt.Sprintf("uid-%s", integrationType),
				Name: fmt.Sprintf("name-%s", integrationType),
				Integrations: []*models.Integration{
					{
						UID:                   fmt.Sprintf("intuid-%s", integrationType),
						Name:                  fmt.Sprintf("name-%s", integrationType),
						Config:                schema,
						DisableResolveMessage: false,
						Settings:              settingsMap,
						SecureSettings:        nil,
					},
				},
				Provenance: "api",
				Version:    "1234",
			}

			result, err := convertToK8sResource(1, recCfg, &models.ReceiverPermissionSet{}, &models.ReceiverMetadata{}, request.GetNamespaceMapper(nil))
			require.NoError(t, err)

			back, err := convertToDomainModel(result)
			require.NoError(t, err)

			switch integrationType {
			case "webhook": // webhook has a different format for maxAlerts, in test config it's a string, in API model it's an int.
				val := back.Integrations[0].Settings["maxAlerts"].(float64)
				back.Integrations[0].Settings["maxAlerts"] = fmt.Sprintf("%d", int(val))
			case "mqtt": // same for qos
				val := back.Integrations[0].Settings["qos"].(float64)
				back.Integrations[0].Settings["qos"] = fmt.Sprintf("%d", int(val))
			}
			diff := cmp.Diff(recCfg, back)
			if len(diff) != 0 {
				require.Failf(t, "The re-marshalled configuration does not match the expected one", diff)
			}
		})
	}
}
