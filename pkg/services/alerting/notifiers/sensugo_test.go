package notifiers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestSensuGoNotifier(t *testing.T) {
	json := `{ }`

	settingsJSON, err := simplejson.NewJson([]byte(json))
	require.NoError(t, err)
	model := &models.AlertNotification{
		Name:     "Sensu Go",
		Type:     "sensugo",
		Settings: settingsJSON,
	}

	encryptionService := encryptionservice.SetupTestService(t)

	_, err = NewSensuGoNotifier(model, encryptionService.GetDecryptedValue, nil)
	require.Error(t, err)

	json = `
	{
		"url": "http://sensu-api.example.com:8080",
		"entity": "grafana_instance_01",
		"check": "grafana_rule_0",
		"namespace": "default",
		"handler": "myhandler",
		"apikey": "abcdef0123456789abcdef"
	}`

	settingsJSON, err = simplejson.NewJson([]byte(json))
	require.NoError(t, err)
	model = &models.AlertNotification{
		Name:     "Sensu Go",
		Type:     "sensugo",
		Settings: settingsJSON,
	}

	not, err := NewSensuGoNotifier(model, encryptionService.GetDecryptedValue, nil)
	require.NoError(t, err)
	sensuGoNotifier := not.(*SensuGoNotifier)

	assert.Equal(t, "Sensu Go", sensuGoNotifier.Name)
	assert.Equal(t, "sensugo", sensuGoNotifier.Type)
	assert.Equal(t, "http://sensu-api.example.com:8080", sensuGoNotifier.URL)
	assert.Equal(t, "grafana_instance_01", sensuGoNotifier.Entity)
	assert.Equal(t, "grafana_rule_0", sensuGoNotifier.Check)
	assert.Equal(t, "default", sensuGoNotifier.Namespace)
	assert.Equal(t, "myhandler", sensuGoNotifier.Handler)
	assert.Equal(t, "abcdef0123456789abcdef", sensuGoNotifier.APIKey)
}
