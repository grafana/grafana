package notifiers

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	encryptionservice "github.com/grafana/grafana/pkg/services/encryption/service"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSlackNotifier(t *testing.T) {
	encryptionService := encryptionservice.SetupTestService(t)

	t.Run("empty settings should return error", func(t *testing.T) {
		json := `{ }`

		settingsJSON, err := simplejson.NewJson([]byte(json))
		require.NoError(t, err)
		model := &models.AlertNotification{
			Name:     "ops",
			Type:     "slack",
			Settings: settingsJSON,
		}

		_, err = NewSlackNotifier(model, encryptionService.GetDecryptedValue, nil)
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

		not, err := NewSlackNotifier(model, encryptionService.GetDecryptedValue, nil)
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

		not, err := NewSlackNotifier(model, encryptionService.GetDecryptedValue, nil)
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

		encryptionService := encryptionService
		securedSettingsJSON, err := encryptionService.EncryptJsonData(
			context.Background(),
			map[string]string{
				"token": "xenc-XXXXXXXX-XXXXXXXX-XXXXXXXXXX",
			}, setting.SecretKey)
		require.NoError(t, err)

		model := &models.AlertNotification{
			Name:           "ops",
			Type:           "slack",
			Settings:       settingsJSON,
			SecureSettings: securedSettingsJSON,
		}

		not, err := NewSlackNotifier(model, encryptionService.GetDecryptedValue, nil)
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

		not, err := NewSlackNotifier(model, encryptionService.GetDecryptedValue, nil)
		require.NoError(t, err)
		slackNotifier := not.(*SlackNotifier)
		assert.Equal(t, "1ABCDE", slackNotifier.recipient)
	})
}

func TestSendSlackRequest(t *testing.T) {
	tests := []struct {
		name          string
		slackResponse string
		statusCode    int
		expectError   bool
	}{
		{
			name: "Example error",
			slackResponse: `{
					"ok": false,
					"error": "too_many_attachments"
				}`,
			statusCode:  http.StatusBadRequest,
			expectError: true,
		},
		{
			name:        "Non 200 status code, no response body",
			statusCode:  http.StatusMovedPermanently,
			expectError: true,
		},
		{
			name: "Success case, normal response body",
			slackResponse: `{
				"ok": true,
				"channel": "C1H9RESGL",
				"ts": "1503435956.000247",
				"message": {
					"text": "Here's a message for you",
					"username": "ecto1",
					"bot_id": "B19LU7CSY",
					"attachments": [
						{
							"text": "This is an attachment",
							"id": 1,
							"fallback": "This is an attachment's fallback"
						}
					],
					"type": "message",
					"subtype": "bot_message",
					"ts": "1503435956.000247"
				}
			}`,
			statusCode:  http.StatusOK,
			expectError: false,
		},
		{
			name:       "No response body",
			statusCode: http.StatusOK,
		},
		{
			name:          "Success case, unexpected response body",
			statusCode:    http.StatusOK,
			slackResponse: `{"test": true}`,
			expectError:   false,
		},
		{
			name:          "Success case, ok: true",
			statusCode:    http.StatusOK,
			slackResponse: `{"ok": true}`,
			expectError:   false,
		},
		{
			name:          "200 status code, error in body",
			statusCode:    http.StatusOK,
			slackResponse: `{"ok": false, "error": "test error"}`,
			expectError:   true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.statusCode)
				_, err := w.Write([]byte(test.slackResponse))
				require.NoError(tt, err)
			}))

			settingsJSON, err := simplejson.NewJson([]byte(fmt.Sprintf(`{"url": %q}`, server.URL)))
			require.NoError(t, err)
			model := &models.AlertNotification{
				Settings: settingsJSON,
			}

			encryptionService := encryptionservice.SetupTestService(t)

			not, err := NewSlackNotifier(model, encryptionService.GetDecryptedValue, nil)
			require.NoError(t, err)
			slackNotifier := not.(*SlackNotifier)

			err = slackNotifier.sendRequest(context.Background(), []byte("test"))
			if !test.expectError {
				require.NoError(tt, err)
			} else {
				require.Error(tt, err)
			}
		})
	}
}
