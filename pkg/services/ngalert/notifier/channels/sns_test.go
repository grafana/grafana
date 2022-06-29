package channels

import (
	"context"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSNSNotifier(t *testing.T) {
	t.Run("AWS SNS notifier tests", func(t *testing.T) {
		t.Run("Parsing alert notification from settings", func(t *testing.T) {
			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			decryptFn := secretsService.GetDecryptedValue
			tmpl := templateForTests(t)
			externalURL, _ := url.Parse("http://localhost")
			tmpl.ExternalURL = externalURL
			t.Run("empty settings return error", func(t *testing.T) {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &NotificationChannelConfig{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				_, err := NewSNSNotifier(model, tmpl, decryptFn)
				require.Error(t, err)
			})

			t.Run("invalid topic arn", func(t *testing.T) {
				json := `
				{
					"topic": "arn:aws:sns:us-east-1:123456789",
					"accessKey": "",
					"secretKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
					"authProvider": "credentialsProf"
				}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &NotificationChannelConfig{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				_, err := NewSNSNotifier(model, tmpl, decryptFn)
				require.Error(t, err)
			})

			t.Run("access key and secret key auth provider settings", func(t *testing.T) {
				t.Run("Empty Access Key or Secret Key", func(t *testing.T) {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "",
						"secretKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
						"authProvider": "keys"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &NotificationChannelConfig{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := NewSNSNotifier(model, tmpl, decryptFn)
					require.Error(t, err)

					json = `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
						"secretKey": "",
						"authProvider": "keys"
					}`

					settingsJSON, _ = simplejson.NewJson([]byte(json))
					model = &NotificationChannelConfig{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err = NewSNSNotifier(model, tmpl, decryptFn)
					require.Error(t, err)
				})

				t.Run("Valid Access and Secret Key", func(t *testing.T) {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
						"secretKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
						"authProvider": "keys"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &NotificationChannelConfig{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					snsNotifier, err := NewSNSNotifier(model, tmpl, decryptFn)

					require.Nil(t, err)
					assert.Equal(t, "AWS SNS", snsNotifier.Name)
					assert.Equal(t, "sns", snsNotifier.Type)
					assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
					assert.Equal(t, "keys", snsNotifier.AWSDatasourceSettings.AuthType.String())
					assert.Equal(t, "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve", snsNotifier.AWSDatasourceSettings.AccessKey)
					assert.Equal(t, "tzNZYf36y0ohWwXo4XoUrB61rz1A4o", snsNotifier.AWSDatasourceSettings.SecretKey)
				})
			})

			t.Run("Credential Profile auth provider settings", func(t *testing.T) {
				t.Run("Empty profile", func(t *testing.T) {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"credentials": "",
						"authProvider": "credentials"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &NotificationChannelConfig{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := NewSNSNotifier(model, tmpl, decryptFn)
					require.Error(t, err)
				})

				t.Run("Valid Credentials Profile", func(t *testing.T) {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"credentials": "dev",
						"authProvider": "credentials"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &NotificationChannelConfig{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					snsNotifier, err := NewSNSNotifier(model, tmpl, decryptFn)

					require.Nil(t, err)
					assert.Equal(t, "AWS SNS", snsNotifier.Name)
					assert.Equal(t, "sns", snsNotifier.Type)
					assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
					assert.Equal(t, "credentials", snsNotifier.AWSDatasourceSettings.AuthType.String())
					assert.Equal(t, "dev", snsNotifier.AWSDatasourceSettings.Profile)
				})
			})

			t.Run("AWS SDK Default auth provider settings", func(t *testing.T) {
				json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default"
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &NotificationChannelConfig{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				snsNotifier, err := NewSNSNotifier(model, tmpl, decryptFn)

				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())
			})
			t.Run("SNS Templating Test", func(t *testing.T) {
				json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default",
						"subject": "{{ len .Alerts.Firing }} subject",
						"body": "{{ len .Alerts.Firing }} body",
						"messageFormat": "body"
					}`
				secureSettings := make(map[string][]byte)
				settingsJSON, _ := simplejson.NewJson([]byte(json))
				channelModel := &NotificationChannelConfig{
					Name:           "AWS SNS",
					Type:           "sns",
					Settings:       settingsJSON,
					SecureSettings: secureSettings,
				}
				alerts := []*types.Alert{
					{
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
							Annotations: model.LabelSet{"ann1": "annv1"},
						},
					}, {
						Alert: model.Alert{
							Labels:      model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
							Annotations: model.LabelSet{"ann1": "annv2"},
						},
					},
				}
				ctx := notify.WithGroupKey(context.Background(), "alertname")
				snsNotifier, err := NewSNSNotifier(channelModel, tmpl, decryptFn)
				_, notifyErr := snsNotifier.Notify(ctx, alerts...)

				require.Nil(t, err)
				require.Nil(t, notifyErr)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "2 body", snsNotifier.Message)
				assert.Equal(t, "2 subject", snsNotifier.Subject)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())
			})
		})
	})
}
