package services

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/stretchr/testify/require"
)

func TestGrafanaSlack(t *testing.T) {
	slackContactPoint := EmbeddedContactPoint{
		Type: "kafka",
		Name: "My first own contact point",
		Settings: simplejson.NewFromAny(map[string]interface{}{
			"kafkaRestProxy": "http://localhost:1234/",
			"kafkaTopic":     "thisIsMyTopic",
		}),
	}
	_, err := slackContactPoint.IsValid()
	require.NoError(t, err)
}
