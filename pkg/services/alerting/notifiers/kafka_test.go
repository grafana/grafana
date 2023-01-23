package notifiers

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
)

func TestKafkaNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("Parsing alert notification from settings", func(t *testing.T) {
		t.Run("empty settings should return error", func(t *testing.T) {
			json := `{ }`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "kafka_testing",
				Type:     "kafka",
				Settings: settingsJSON,
			}

			_, err := NewKafkaNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.Error(t, err)
		})

		t.Run("settings should send an event to kafka", func(t *testing.T) {
			json := `
				{
					"kafkaRestProxy": "http://localhost:8082",
					"kafkaTopic": "topic1"
				}`

			settingsJSON, _ := simplejson.NewJson([]byte(json))
			model := &models.AlertNotification{
				Name:     "kafka_testing",
				Type:     "kafka",
				Settings: settingsJSON,
			}

			not, err := NewKafkaNotifier(model, encryptionService.GetDecryptedValue, nil)
			kafkaNotifier := not.(*KafkaNotifier)

			require.Nil(t, err)
			require.Equal(t, "kafka_testing", kafkaNotifier.Name)
			require.Equal(t, "kafka", kafkaNotifier.Type)
			require.Equal(t, "http://localhost:8082", kafkaNotifier.Endpoint)
			require.Equal(t, "topic1", kafkaNotifier.Topic)
		})
	})
}
