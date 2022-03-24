package notifiers

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/validations"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSNSNotifier(t *testing.T) {
	Convey("AWS SNS notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				_, err := newSNSNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("invalid topic arn", func() {
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

				_, err := newSNSNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("assume role auth provider settings", func() {
				Convey("Empty Access Key or Secret Key", func() {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"assumeRoleARN": "",
						"authProvider": "arn"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := newSNSNotifier(model)
					So(err, ShouldNotBeNil)
				})
				Convey("Valid Assume Role ARN", func() {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"assumeRoleARN": "testARN",
						"authProvider": "arn"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					not, err := newSNSNotifier(model)
					snsNotifier := not.(*SNSNotifier)

					So(err, ShouldBeNil)
					So(snsNotifier.Name, ShouldEqual, "AWS SNS")
					So(snsNotifier.Type, ShouldEqual, "sns")
					So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
					So(snsNotifier.AwsSessionCredentialsInput.Region, ShouldEqual, "us-east-1")
					So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "arn")
					So(snsNotifier.AwsSessionCredentialsInput.AssumeRoleArn, ShouldEqual, "testARN")
				})
			})

			Convey("access key and secret key auth provider settings", func() {
				Convey("Empty Access Key or Secret Key", func() {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "",
						"secretKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
						"authProvider": "accessKeyAndSecretKey"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := newSNSNotifier(model)
					So(err, ShouldNotBeNil)

					json = `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
						"secretKey": "",
						"authProvider": "accessKeyAndSecretKey"
					}`

					settingsJSON, _ = simplejson.NewJson([]byte(json))
					model = &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err = newSNSNotifier(model)
					So(err, ShouldNotBeNil)
				})

				Convey("Valid Access and Secret Key", func() {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"accessKey": "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve",
						"secretKey": "tzNZYf36y0ohWwXo4XoUrB61rz1A4o",
						"authProvider": "accessKeyAndSecretKey"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					not, err := newSNSNotifier(model)
					snsNotifier := not.(*SNSNotifier)

					So(err, ShouldBeNil)
					So(snsNotifier.Name, ShouldEqual, "AWS SNS")
					So(snsNotifier.Type, ShouldEqual, "sns")
					So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
					So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "accessKeyAndSecretKey")
					So(snsNotifier.AwsSessionCredentialsInput.AccessKey, ShouldEqual, "4SrUFQL4A5V5TQ1z5Pg9nxHXPXSTve")
					So(snsNotifier.AwsSessionCredentialsInput.SecretKey, ShouldEqual, "tzNZYf36y0ohWwXo4XoUrB61rz1A4o")
				})
			})

			Convey("Credential Profile auth provider settings", func() {
				Convey("Empty profile", func() {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"credentialsProfile": "",
						"authProvider": "credentialsProfile"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					_, err := newSNSNotifier(model)
					So(err, ShouldNotBeNil)
				})

				Convey("Valid Credentials Profile", func() {
					json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"credentialsProfile": "dev",
						"authProvider": "credentialsProfile"
					}`

					settingsJSON, _ := simplejson.NewJson([]byte(json))
					model := &models.AlertNotification{
						Name:     "AWS SNS",
						Type:     "sns",
						Settings: settingsJSON,
					}

					not, err := newSNSNotifier(model)
					snsNotifier := not.(*SNSNotifier)

					So(err, ShouldBeNil)
					So(snsNotifier.Name, ShouldEqual, "AWS SNS")
					So(snsNotifier.Type, ShouldEqual, "sns")
					So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
					So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "credentialsProfile")
					So(snsNotifier.AwsSessionCredentialsInput.CredentialsProfile, ShouldEqual, "dev")
				})
			})

			Convey("AWS SDK Default auth provider settings", func() {
				json := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "authTypeDefault"
					}`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "AWS SNS",
					Type:     "sns",
					Settings: settingsJSON,
				}

				not, err := newSNSNotifier(model)
				snsNotifier := not.(*SNSNotifier)

				So(err, ShouldBeNil)
				So(snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(snsNotifier.Type, ShouldEqual, "sns")
				So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
				So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "authTypeDefault")
			})

			Convey("Valid JSON message body without tags", func() {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "authTypeDefault",
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
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model)
				snsNotifier := not.(*SNSNotifier)
				So(err, ShouldBeNil)
				So(snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(snsNotifier.Type, ShouldEqual, "sns")
				So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
				So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "authTypeDefault")

				expectedResultJson := simplejson.New()
				expectedResultJson.Set("state", evalContext.Rule.State)
				expectedResultJson.Set("body", evalContext.Rule.Message)
				rawBytes, err := json.MarshalIndent(expectedResultJson, "", "    ")
				So(err, ShouldBeNil)

				expectedResult := string(rawBytes)
				result, err := snsNotifier.buildMessageContent(evalContext)
				So(result, ShouldEqual, expectedResult)
				So(err, ShouldBeNil)
			})

			Convey("Valid JSON message body with tags", func() {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "authTypeDefault",
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
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model)
				snsNotifier := not.(*SNSNotifier)
				So(err, ShouldBeNil)
				So(snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(snsNotifier.Type, ShouldEqual, "sns")
				So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
				So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "authTypeDefault")

				expectedResultJson := simplejson.New()
				expectedResultJson.Set("state", evalContext.Rule.State)
				expectedResultJson.Set("body", evalContext.Rule.Message)
				expectedResultJson.Set("sns_tag-prefix-sample", "this tag should be visible")
				expectedResultJson.Set("no-tag-prefix-sample", "this tag should be visible")
				expectedResultJson.Set("severity", "warning")
				rawBytes, err := json.MarshalIndent(expectedResultJson, "", "    ")
				So(err, ShouldBeNil)

				expectedResult := string(rawBytes)
				result, err := snsNotifier.buildMessageContent(evalContext)
				So(result, ShouldEqual, expectedResult)
				So(err, ShouldBeNil)
			})

			Convey("Valid text message body without tags", func() {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "authTypeDefault",
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
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model)
				snsNotifier := not.(*SNSNotifier)
				So(err, ShouldBeNil)
				So(snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(snsNotifier.Type, ShouldEqual, "sns")
				So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
				So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "authTypeDefault")

				expectedResult := string("State: " + evalContext.Rule.State + "\n")
				expectedResult += evalContext.Rule.Message

				result, err := snsNotifier.buildMessageContent(evalContext)
				So(result, ShouldEqual, expectedResult)
				So(err, ShouldBeNil)
			})

			Convey("Valid text message body with tags", func() {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "authTypeDefault",
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
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model)
				snsNotifier := not.(*SNSNotifier)
				So(err, ShouldBeNil)
				So(snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(snsNotifier.Type, ShouldEqual, "sns")
				So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
				So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "authTypeDefault")

				expectedResult := string("state:" + evalContext.Rule.State + "\n")
				expectedResult += "body:" + evalContext.Rule.Message + "\n"
				expectedResult += "tag-sample-1:show this tag\n"
				expectedResult += "tag-sample-2:show this tag\n"
				expectedResult += "severity:warning\n"

				result, err := snsNotifier.buildMessageContent(evalContext)
				So(result, ShouldEqual, expectedResult)
				So(err, ShouldBeNil)
			})

			Convey("Unspecified messageFormat backwards compatible", func() {
				setupJson := `
					{
						"topic": "arn:aws:sns:us-east-1:123456789:test",
						"authProvider": "authTypeDefault"
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
				}, &validations.OSSPluginRequestValidator{})
				evalContext.IsTestRun = true
				not, err := newSNSNotifier(model)
				snsNotifier := not.(*SNSNotifier)
				So(err, ShouldBeNil)
				So(snsNotifier.Name, ShouldEqual, "AWS SNS")
				So(snsNotifier.Type, ShouldEqual, "sns")
				So(snsNotifier.SnsTopic, ShouldEqual, "arn:aws:sns:us-east-1:123456789:test")
				So(snsNotifier.AwsSessionCredentialsInput.AuthType, ShouldEqual, "authTypeDefault")

				expectedResult := string("State: " + evalContext.Rule.State + "\n")
				expectedResult += evalContext.Rule.Message

				result, err := snsNotifier.buildMessageContent(evalContext)
				So(result, ShouldEqual, expectedResult)
				So(err, ShouldBeNil)
			})
		})
	})
}
