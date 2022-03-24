package notifiers

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/sns"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "sns",
		Name:        "AWS SNS",
		Description: "Sends message to AWS SNS Topic",
		Heading:     "AWS SNS settings",
		Factory:     newSNSNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Topic",
				Element:      alerting.ElementTypeInput,
				Required:     true,
				InputType:    alerting.InputTypeText,
				Placeholder:  "snsTopic",
				PropertyName: "topic",
			},
			{
				Label:    "Auth Provider",
				Element:  alerting.ElementTypeSelect,
				Required: true,
				SelectOptions: []alerting.SelectOption{
					{
						Value: "authTypeDefault",
						Label: "Workspace IAM Role",
					},
					// {
					// 	Value: "credentialsProfile",
					// 	Label: "Credentials profile",
					// },
					{
						Value: "accessKeyAndSecretKey",
						Label: "Access & secret key",
					},
					{
						Value: "arn",
						Label: "ARN",
					},
				},
				PropertyName: "authProvider",
			},
			{
				Label:    "Message body format",
				Element:  alerting.ElementTypeSelect,
				Required: true,
				SelectOptions: []alerting.SelectOption{
					{
						Value: "text",
						Label: "Text",
					},
					{
						Value: "json",
						Label: "JSON",
					},
				},
				PropertyName: "messageFormat",
			},
			{
				Label:        "Include all tags in the message",
				Element:      alerting.ElementTypeCheckbox,
				PropertyName: "includeTags",
			},
			{
				Label:        "Credentials Profile",
				Element:      alerting.ElementTypeInput,
				Required:     true,
				InputType:    alerting.InputTypeText,
				Placeholder:  "default",
				PropertyName: "credentialsProfile",
				ShowWhen: alerting.ShowWhen{
					Field: "authProvider",
					Is:    "credentialsProfile",
				},
			},
			{
				Label:        "Access Key",
				Element:      alerting.ElementTypeInput,
				Required:     true,
				Secure:       true,
				InputType:    alerting.InputTypeText,
				Placeholder:  "",
				PropertyName: "accessKey",
				ShowWhen: alerting.ShowWhen{
					Field: "authProvider",
					Is:    "accessKeyAndSecretKey",
				},
			},
			{
				Label:        "Secret Key",
				Element:      alerting.ElementTypeInput,
				Required:     true,
				Secure:       true,
				InputType:    alerting.InputTypeText,
				Placeholder:  "",
				PropertyName: "secretKey",
				ShowWhen: alerting.ShowWhen{
					Field: "authProvider",
					Is:    "accessKeyAndSecretKey",
				},
			},
			{
				Label:        "Assume Role ARN",
				Element:      alerting.ElementTypeInput,
				Required:     true,
				InputType:    alerting.InputTypeText,
				Placeholder:  "arn:aws:iam:*",
				PropertyName: "assumeRoleARN",
				ShowWhen: alerting.ShowWhen{
					Field: "authProvider",
					Is:    "arn",
				},
			},
			{
				Label:        "External ID",
				Element:      alerting.ElementTypeInput,
				Required:     false,
				InputType:    alerting.InputTypeText,
				Placeholder:  "ExternalID",
				PropertyName: "externalId",
				ShowWhen: alerting.ShowWhen{
					Field: "authProvider",
					Is:    "arn",
				},
			},
		},
	})
}
func newSNSNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	topicArn := model.Settings.Get("topic").MustString()

	// parse the region out of the ARN example: arn:aws:sns:us-west-2:479104307918:GrafanaTestUSWEST2
	arnSlice := strings.Split(topicArn, ":")
	if len(arnSlice) != 6 {
		return nil, alerting.ValidationError{Reason: "Invalid topic ARN provided."}
	}

	region := arnSlice[3]

	authType := model.Settings.Get("authProvider").MustString()
	assumeRoleArn := model.Settings.Get("assumeRoleARN").MustString()
	externalID := model.Settings.Get("externalId").MustString()
	accessKey := model.DecryptedValue("accessKey", model.Settings.Get("accessKey").MustString())
	secretKey := model.DecryptedValue("secretKey", model.Settings.Get("secretKey").MustString())
	credentialsProfile := model.Settings.Get("credentialsProfile").MustString()
	messageFormat := model.Settings.Get("messageFormat").MustString("text")
	includeTags := model.Settings.Get("includeTags").MustBool(false)

	switch {
	case authType == "arn":
		if assumeRoleArn == "" {
			return nil, alerting.ValidationError{Reason: "IAM Role not provided."}
		}
	case authType == "accessKeyAndSecretKey":
		if accessKey == "" {
			return nil, alerting.ValidationError{Reason: "Access Key not provided."}
		}
		if secretKey == "" {
			return nil, alerting.ValidationError{Reason: "Secret Key not provided."}
		}
	case authType == "credentialsProfile":
		if credentialsProfile == "" {
			return nil, alerting.ValidationError{Reason: "Credentials Profile not provided."}
		}
	}

	awsSessionCredentialsInput := AwsSessionCredentialsInput{
		AuthType:           authType,
		AssumeRoleArn:      assumeRoleArn,
		ExternalID:         externalID,
		AccessKey:          accessKey,
		SecretKey:          secretKey,
		CredentialsProfile: credentialsProfile,
		Region:             region,
	}

	return &SNSNotifier{
		NotifierBase:               NewNotifierBase(model),
		SnsTopic:                   topicArn,
		Region:                     region,
		AwsSessionCredentialsInput: awsSessionCredentialsInput,
		Message:                    "",
		MessageFormat:              messageFormat,
		IncludeTags:                includeTags,
		log:                        log.New("alerting.notifier.sns"),
	}, nil
}

// SNSNotifier is responsible for sending alert notifications to AWS SNS.
type SNSNotifier struct {
	NotifierBase
	SnsTopic                   string
	Message                    string
	MessageFormat              string
	IncludeTags                bool
	SNSClient                  *sns.SNS
	Region                     string
	AwsSessionCredentialsInput AwsSessionCredentialsInput
	log                        log.Logger
}

// createTextContent is a helper function creating the text formatted string return message.
func (snsNotifier *SNSNotifier) createTextContent(evalContext *alerting.EvalContext) string {
	var textContent string

	if snsNotifier.IncludeTags {
		textContent = string("state:" + evalContext.Rule.State + "\n")
		textContent += "body:" + evalContext.Rule.Message + "\n"
		for _, tag := range evalContext.Rule.AlertRuleTags {
			addTags := tag.Key + ":" + tag.Value + "\n"
			textContent += addTags
		}
	} else {
		textContent = string("State: " + evalContext.Rule.State + "\n")
		textContent += evalContext.Rule.Message
	}

	return textContent
}

// createJSONContent is a helper function creating the JSON formatted string return message.
func (snsNotifier *SNSNotifier) createJSONContent(evalContext *alerting.EvalContext) (string, error) {
	jsonPayload := simplejson.New()
	jsonPayload.Set("state", evalContext.Rule.State)
	jsonPayload.Set("body", evalContext.Rule.Message)

	if snsNotifier.IncludeTags {
		for _, tag := range evalContext.Rule.AlertRuleTags {
			jsonPayload.Set(tag.Key, tag.Value)
		}
	}

	rawBytes, jsonErr := json.MarshalIndent(jsonPayload, "", "    ")
	jsonContent := string(rawBytes)
	return jsonContent, jsonErr
}

// buildMessageContent creates the message content sent to AWS SNS.
func (snsNotifier *SNSNotifier) buildMessageContent(evalContext *alerting.EvalContext) (string, error) {
	var err error = nil
	var messageContent string

	switch snsNotifier.MessageFormat {
	case "text":
		messageContent = snsNotifier.createTextContent(evalContext)

	case "json":
		messageContent, err = snsNotifier.createJSONContent(evalContext)

	default:
		snsNotifier.log.Warn("Invalid message format specified. Defaulting to text message format", "messageFormat", snsNotifier.MessageFormat)
		messageContent = snsNotifier.createTextContent(evalContext)
	}

	return messageContent, err
}

// Notify sends the alert notification to AWS SNS.
func (snsNotifier *SNSNotifier) Notify(evalContext *alerting.EvalContext) error {
	snsNotifier.log.Info("Sending to AWS SNS")
	metrics.MAlertingSNS.Inc()

	session, err := getAWSAuthorizedSession(&snsNotifier.AwsSessionCredentialsInput)

	if err != nil {
		return err
	}

	message, err := snsNotifier.buildMessageContent(evalContext)

	if err != nil {
		return err
	}

	snsClient := sns.New(session, aws.NewConfig())

	input := &sns.PublishInput{
		Subject:  aws.String("State: " + strings.ToUpper(string(evalContext.Rule.State))),
		Message:  aws.String(message),
		TopicArn: aws.String(snsNotifier.SnsTopic),
	}

	_, err = snsClient.Publish(input)

	if err != nil {
		var awsErr awserr.Error
		if errors.As(err, &awsErr) {
			switch awsErr.Code() {
			case sns.ErrCodeAuthorizationErrorException:
				metrics.MAlertingSNSAccessDenied.Inc()
			default:
				metrics.MAlertingSNSInternalError.Inc()
			}
		}
		snsNotifier.log.Error("Failed to publish to AWS SNS. ", "error", err)
	}

	return nil
}
