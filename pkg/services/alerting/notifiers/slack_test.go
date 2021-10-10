package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSlackNotifier(t *testing.T) {
	secretsService := secrets.SetupTestService(t)

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		_, err = NewSlackNotifier(model, secretsService.GetDecryptedValue)
		assert.EqualError(t, err, "alert validation error: recipient must be specified when using the Slack chat API")
	})

	t.Run("from settings", func(t *testing.T) {
		json := `
				{
          "url": "http://google.com"
				}`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		not, err := NewSlackNotifier(model, secretsService.GetDecryptedValue)
		require.NoError(t, err)
		slackNotifier := not.(*SlackNotifier)
		assert.Equal(t, "ops", slackNotifier.Name)
		assert.Equal(t, "slack", slackNotifier.Type)
		assert.Equal(t, "http://google.com", slackNotifier.url.String())
		assert.Empty(t, slackNotifier.recipient)
		assert.Empty(t, slackNotifier.username)
		assert.Empty(t, slackNotifier.iconEmoji)
		assert.Empty(t, slackNotifier.iconURL)
		assert.Empty(t, slackNotifier.mentionUsers)
		assert.Empty(t, slackNotifier.mentionGroups)
		assert.Empty(t, slackNotifier.mentionChannel)
		assert.Empty(t, slackNotifier.token)
	})

	t.Run("from settings with Recipient, Username, IconEmoji, IconUrl, MentionUsers, MentionGroups, MentionChannel, and Token", func(t *testing.T) {
		json := `
                    {
                      "url": "http://google.com",
                      "recipient": "#ds-opentsdb",
                      "username": "Grafana Alerts",
                      "icon_emoji": ":smile:",
                      "icon_url": "https://grafana.com/img/fav32.png",
                      "mentionUsers": "user1, user2",
                      "mentionGroups": "group1, group2",
                      "mentionChannel": "here",
                      "token": "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
                    }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		not, err := NewSlackNotifier(model, secretsService.GetDecryptedValue)
		require.NoError(t, err)
		slackNotifier := not.(*SlackNotifier)
		assert.Equal(t, "ops", slackNotifier.Name)
		assert.Equal(t, "slack", slackNotifier.Type)
		assert.Equal(t, "http://google.com", slackNotifier.url.String())
		assert.Equal(t, "#ds-opentsdb", slackNotifier.recipient)
		assert.Equal(t, "Grafana Alerts", slackNotifier.username)
		assert.Equal(t, ":smile:", slackNotifier.iconEmoji)
		assert.Equal(t, "https://grafana.com/img/fav32.png", slackNotifier.iconURL)
		assert.Equal(t, []string{"user1", "user2"}, slackNotifier.mentionUsers)
		assert.Equal(t, []string{"group1", "group2"}, slackNotifier.mentionGroups)
		assert.Equal(t, "here", slackNotifier.mentionChannel)
		assert.Equal(t, "xoxb-XXXXXXXX-XXXXXXXX-XXXXXXXXXX", slackNotifier.token)
	})

	t.Run("from settings with Recipient, Username, IconEmoji, IconUrl, MentionUsers, MentionGroups, MentionChannel, and Secured Token", func(t *testing.T) {
		json := `
                    {
                      "url": "http://google.com",
                      "recipient": "#ds-opentsdb",
                      "username": "Grafana Alerts",
                      "icon_emoji": ":smile:",
                      "icon_url": "https://grafana.com/img/fav32.png",
                      "mentionUsers": "user1, user2",
                      "mentionGroups": "group1, group2",
                      "mentionChannel": "here",
                      "token": "uenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX"
                    }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)

		securedSettingsJSON, err := secretsService.EncryptJsonData(
			context.Background(),
			map[string]string{
				"token": "xenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX",
			}, secrets.WithoutScope())
		require.NoError(t, err)

		model := &models.AlertNotification{
			Name:           "ops",
			Type:           "slack",
			Settings:       settingsJSON,
			SecureSettings: securedSettingsJSON,
		}

		not, err := NewSlackNotifier(model, secretsService.GetDecryptedValue)
		require.NoError(t, err)
		slackNotifier := not.(*SlackNotifier)
		assert.Equal(t, "ops", slackNotifier.Name)
		assert.Equal(t, "slack", slackNotifier.Type)
		assert.Equal(t, "http://google.com", slackNotifier.url.String())
		assert.Equal(t, "#ds-opentsdb", slackNotifier.recipient)
		assert.Equal(t, "Grafana Alerts", slackNotifier.username)
		assert.Equal(t, ":smile:", slackNotifier.iconEmoji)
		assert.Equal(t, "https://grafana.com/img/fav32.png", slackNotifier.iconURL)
		assert.Equal(t, []string{"user1", "user2"}, slackNotifier.mentionUsers)
		assert.Equal(t, []string{"group1", "group2"}, slackNotifier.mentionGroups)
		assert.Equal(t, "here", slackNotifier.mentionChannel)
		assert.Equal(t, "xenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX", slackNotifier.token)
	})

	t.Run("with channel recipient with spaces should return an error", func(t *testing.T) {
		json := `
                    {
                      "url": "http://google.com",
                      "recipient": "#open tsdb"
                    }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		_, err = NewSlackNotifier(model, secretsService.GetDecryptedValue)
		assert.EqualError(t, err, "alert validation error: recipient on invalid format: \"#open tsdb\"")
	})

	t.Run("with user recipient with spaces should return an error", func(t *testing.T) {
		json := `
                    {
                      "url": "http://google.com",
                      "recipient": "@user name"
                    }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		_, err = NewSlackNotifier(model, secretsService.GetDecryptedValue)
		assert.EqualError(t, err, "alert validation error: recipient on invalid format: \"@user name\"")
	})

	t.Run("with user recipient with uppercase letters should return an error", func(t *testing.T) {
		json := `
                    {
                      "url": "http://google.com",
                      "recipient": "@User"
                    }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		_, err = NewSlackNotifier(model, secretsService.GetDecryptedValue)
		assert.EqualError(t, err, "alert validation error: recipient on invalid format: \"@User\"")
	})

	t.Run("with Slack ID for recipient should work", func(t *testing.T) {
		json := `
                    {
                      "url": "http://google.com",
                      "recipient": "1ABCDE"
                    }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		not, err := NewSlackNotifier(model, secretsService.GetDecryptedValue)
		require.NoError(t, err)
		slackNotifier := not.(*SlackNotifier)
		assert.Equal(t, "1ABCDE", slackNotifier.recipient)
	})
}
