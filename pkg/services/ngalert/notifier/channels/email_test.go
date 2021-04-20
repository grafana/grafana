package channels

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestEmailNotifier(t *testing.T) {
	externalURL, err := url.Parse("http://localhost")
	require.NoError(t, err)

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, _ := simplejson.NewJson([]byte(json))
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "email",
			Settings: settingsJSON,
		}

		_, err := NewEmailNotifier(model, externalURL, "")
		require.Error(t, err)
	})

	t.Run("from settings", func(t *testing.T) {
		json := `{"addresses": "ops@grafana.org"}`
		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		emailNotifier, err := NewEmailNotifier(&models.AlertNotification{
			Name:     "ops",
			Type:     "email",
			Settings: settingsJSON,
		}, externalURL, "")

		require.NoError(t, err)
		require.Equal(t, "ops", emailNotifier.Name)
		require.Equal(t, "email", emailNotifier.Type)
		require.Equal(t, []string{"ops@grafana.org"}, emailNotifier.Addresses)
	})

	t.Run("from settings with two emails", func(t *testing.T) {
		json := `{"addresses": "ops@grafana.org;dev@grafana.org"}`
		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		emailNotifier, err := NewEmailNotifier(&models.AlertNotification{
			Name:     "ops",
			Type:     "email",
			Settings: settingsJSON,
		}, externalURL, "")

		require.NoError(t, err)
		require.Equal(t, "ops", emailNotifier.Name)
		require.Equal(t, "email", emailNotifier.Type)
		require.Equal(t, []string{"ops@grafana.org", "dev@grafana.org"}, emailNotifier.Addresses)
	})
}
