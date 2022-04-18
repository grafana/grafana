package notifiers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSNSNotifier(t *testing.T) {
	t.Run("AWS SNS notifier tests", func(t *testing.T) {
		t.Run("Parsing alert notification from settings", func(t *testing.T) {
			t.Run("empty settings return error", func(t *testing.T) {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				_, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
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
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				_, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
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
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
					require.Error(t, err)

					json = `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
						"secretKey": "",
						"authProvider": "keys"
					}`

					settingsJSON, _ = simplejson.NewJson([]byte(json))
					model = &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err = newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
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
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
					snsNotifier := not.(*SNSNotifier)

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
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
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
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
					snsNotifier := not.(*SNSNotifier)

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
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
				snsNotifier := not.(*SNSNotifier)

				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())
			})

			t.Run("Valid JSON message body without tags", func(t *testing.T) {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default",
						"messageFormat": "json"
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(setupJson))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "sns_tag-prefix-sample", Value: "don't show this tag"},
						{Key: "no-tag-prefix-sample", Value: "don't show this tag"},
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{}, nil)
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
				snsNotifier := not.(*SNSNotifier)
				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())

				expectedResultJson := simplejson.New()
				expectedResultJson.Set("state", evalContext.Rule.State)
				expectedResultJson.Set("body", evalContext.Rule.Message)
				rawBytes, err := json.MarshalIndent(expectedResultJson, "", "    ")
				require.Nil(t, err)

				expectedResult := string(rawBytes)
				result, err := snsNotifier.buildMessageContent(evalContext)
				assert.Equal(t, expectedResult, result)
				require.Nil(t, err)
			})

			t.Run("Valid JSON message body with tags", func(t *testing.T) {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default",
						"messageFormat": "json",
						"includeTags": true
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(setupJson))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "sns_tag-prefix-sample", Value: "this tag should be visible"},
						{Key: "no-tag-prefix-sample", Value: "this tag should be visible"},
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{}, nil)
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
				snsNotifier := not.(*SNSNotifier)
				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())

				expectedResultJson := simplejson.New()
				expectedResultJson.Set("state", evalContext.Rule.State)
				expectedResultJson.Set("body", evalContext.Rule.Message)
				expectedResultJson.Set("sns_tag-prefix-sample", "this tag should be visible")
				expectedResultJson.Set("no-tag-prefix-sample", "this tag should be visible")
				expectedResultJson.Set("severity", "warning")
				rawBytes, err := json.MarshalIndent(expectedResultJson, "", "    ")
				require.Nil(t, err)

				expectedResult := string(rawBytes)
				result, err := snsNotifier.buildMessageContent(evalContext)
				assert.Equal(t, expectedResult, result)
				require.Nil(t, err)
			})

			t.Run("Valid text message body without tags", func(t *testing.T) {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default",
						"messageFormat": "text"
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(setupJson))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "sns_tag-prefix-sample", Value: "always show this tag"},
						{Key: "no-tag-prefix-sample", Value: "don't show this tag"},
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{}, nil)
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
				snsNotifier := not.(*SNSNotifier)
				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())

				expectedResult := string("State: " + evalContext.Rule.State + "\n")
				expectedResult += evalContext.Rule.Message

				result, err := snsNotifier.buildMessageContent(evalContext)
				assert.Equal(t, expectedResult, result)
				require.Nil(t, err)
			})

			t.Run("Valid text message body with tags", func(t *testing.T) {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default",
						"messageFormat": "text",
						"includeTags": true
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(setupJson))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "tag-sample-1", Value: "show this tag"},
						{Key: "tag-sample-2", Value: "show this tag"},
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{}, nil)
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
				snsNotifier := not.(*SNSNotifier)
				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())

				expectedResult := string("state:" + evalContext.Rule.State + "\n")
				expectedResult += "body:" + evalContext.Rule.Message + "\n"
				expectedResult += "tag-sample-1:show this tag\n"
				expectedResult += "tag-sample-2:show this tag\n"
				expectedResult += "severity:warning\n"

				result, err := snsNotifier.buildMessageContent(evalContext)
				assert.Equal(t, expectedResult, result)
				require.Nil(t, err)
			})

			t.Run("Unspecified messageFormat backwards compatible", func(t *testing.T) {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "default"
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(setupJson))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
					ID:      0,
					Name:    "someRule",
					Message: "someMessage",
					State:   models.AlertStateAlerting,
					AlertRuleTags: []*models.Tag{
						{Key: "severity", Value: "warning"},
					},
				}, &validations.OSSPluginRequestValidator{}, nil)
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model, ossencryption.ProvideService().GetDecryptedValue, nil)
				snsNotifier := not.(*SNSNotifier)
				require.Nil(t, err)
				assert.Equal(t, "AWS SNS", snsNotifier.Name)
				assert.Equal(t, "sns", snsNotifier.Type)
				assert.Equal(t, "arn:aws:sns:us-east-1:123456789:test", snsNotifier.SnsTopic)
				assert.Equal(t, "default", snsNotifier.AWSDatasourceSettings.AuthType.String())

				expectedResult := string("State: " + evalContext.Rule.State + "\n")
				expectedResult += evalContext.Rule.Message

				result, err := snsNotifier.buildMessageContent(evalContext)
				assert.Equal(t, expectedResult, result)
				require.Nil(t, err)
			})
		})
	})
}
