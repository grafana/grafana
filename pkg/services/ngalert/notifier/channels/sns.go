package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/sns"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// SNSNotifier is responsible for sending
// alert notifications to AWS SNS
type SNSNotifier struct {
	*Base
	tmpl                  *template.Template
	SnsTopic              string
	Subject               string
	Body                  string
	Message               string
	MessageFormat         string
	RemoveAlertData       bool
	SNSClient             *sns.SNS
	AWSDatasourceSettings *awsds.AWSDatasourceSettings
	log                   log.Logger
}

// NewSNSNotifier is the constructor for the SNS notifier
func NewSNSNotifier(model *NotificationChannelConfig, t *template.Template, fn GetDecryptedValueFn) (*SNSNotifier, error) {
	snsLogger := log.New("unified.notifier.sns")
	topicArn := model.Settings.Get("topic").MustString()

	// parse the region out of the ARN example: arn:aws:sns:us-west-2:479104307918:GrafanaTestUSWEST2
	arnSlice := strings.Split(topicArn, ":")
	if len(arnSlice) != 6 {
		return nil, receiverInitError{Reason: "Invalid topic ARN provided."}
	}

	var externalID, accessKey, secretKey, credentials string
	region := arnSlice[3]
	authType := model.Settings.Get("authProvider").MustString()
	subject := model.Settings.Get("subject").MustString("AWS Grafana - Alert")
	body := model.Settings.Get("body").MustString()
	messageFormat := model.Settings.Get("messageFormat").MustString("text")
	message := model.Settings.Get("text").MustString(`{{ template "default.message" . }}`)

	at := awsds.AuthTypeDefault
	switch authType {
	case awsds.AuthTypeSharedCreds.String():
		credentials = model.Settings.Get("credentials").MustString()
		if credentials == "" {
			return nil, receiverInitError{Reason: "Credentials Profile not provided."}
		}
		at = awsds.AuthTypeSharedCreds
	case awsds.AuthTypeSharedCreds.String():
		credentials = model.Settings.Get("credentialsProfile").MustString()
		if credentials == "" {
			return nil, receiverInitError{Reason: "Credentials Profile not provided."}
		}
		at = awsds.AuthTypeSharedCreds
	case awsds.AuthTypeKeys.String():
		accessKey = fn(context.Background(), model.SecureSettings, "accessKey", model.Settings.Get("accessKey").MustString())
		secretKey = fn(context.Background(), model.SecureSettings, "secretKey", model.Settings.Get("secretKey").MustString())
		if accessKey == "" {
			return nil, receiverInitError{Reason: "Access Key not provided."}
		}
		if secretKey == "" {
			return nil, receiverInitError{Reason: "Secret Key not provided."}
		}
		at = awsds.AuthTypeKeys
	case awsds.AuthTypeDefault.String():
		at = awsds.AuthTypeDefault
	default:
		snsLogger.Warn("Unrecognized AWS authentication type", "type", authType)
	}

	awsDatasourceSettings := &awsds.AWSDatasourceSettings{
		Region:     region,
		AuthType:   at,
		ExternalID: externalID,
		AccessKey:  accessKey,
		SecretKey:  secretKey,
		Profile:    credentials,
	}

	return &SNSNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		SnsTopic:              topicArn,
		AWSDatasourceSettings: awsDatasourceSettings,
		Subject:               subject,
		Body:                  body,
		Message:               message,
		MessageFormat:         messageFormat,
		log:                   snsLogger,
		tmpl:                  t,
	}, nil
}

// createTextContent is a helper function creating the text formatted string return message.
func (snsNotifier *SNSNotifier) createBodyContent(tmpl func(string) string) string {
	bodyMessageContent := tmpl(snsNotifier.Body)
	if len(bodyMessageContent) == 0 {
		bodyMessageContent = "Text Body is empty."
	}
	return bodyMessageContent
}

// createTextContent is a helper function creating the text formatted string return message.
func (snsNotifier *SNSNotifier) createTextContent(tmpl func(string) string) string {
	textMessageContent := tmpl(snsNotifier.Message) + "\n"
	if len(snsNotifier.Body) > 0 {
		textMessageContent += "Body: " + tmpl(snsNotifier.Body)
	}

	return textMessageContent
}

// createJSONContent is a helper function creating the JSON formatted string return message.
func (snsNotifier *SNSNotifier) createJSONContent(tmpl func(string) string, data *ExtendedData) (string, error) {
	var jsonMessageContent []byte
	var jsonErr error

	if len(snsNotifier.Body) > 0 {
		jsonMessageContent, jsonErr = json.MarshalIndent(struct {
			*ExtendedData
			Body string `json:"body"`
		}{
			ExtendedData: data,
			Body:         tmpl(snsNotifier.Body),
		}, "", "\t")
	} else {
		jsonMessageContent, jsonErr = json.MarshalIndent(data, "", "\t")
	}

	return string(jsonMessageContent), jsonErr
}

func (snsNotifier *SNSNotifier) buildMessageContent(evalContext context.Context, as []*types.Alert) (string, error) {
	var err error = nil
	var messageContent string

	tmpl, data := TmplText(evalContext, snsNotifier.tmpl, as, snsNotifier.log, &err)

	if err != nil {
		return "", err
	}

	snsNotifier.Subject = tmpl(snsNotifier.Subject)

	switch snsNotifier.MessageFormat {
	case "body":
		messageContent = snsNotifier.createBodyContent(tmpl)

	case "text":
		messageContent = snsNotifier.createTextContent(tmpl)

	case "json":
		messageContent, err = snsNotifier.createJSONContent(tmpl, data)

	default:
		snsNotifier.log.Warn("Invalid message format specified. Defaulting to text message format", "messageFormat", snsNotifier.MessageFormat)
	}

	return messageContent, err
}

// Notify sends the alert notification to AWS SNS.
func (snsNotifier *SNSNotifier) Notify(evalContext context.Context, as ...*types.Alert) (bool, error) {
	snsNotifier.log.Info("Sending to AWS SNS")

	awsDatasourceSettings := snsNotifier.AWSDatasourceSettings
	awsSessionConfig := &awsds.SessionConfig{
		Settings: *awsDatasourceSettings,
	}

	sessions := awsds.NewSessionCache()
	session, err := sessions.GetSession(*awsSessionConfig)

	if err != nil {
		return false, err
	}

	snsNotifier.Message, err = snsNotifier.buildMessageContent(evalContext, as)

	if err != nil {
		return false, fmt.Errorf("SNS Build Message Failed: %w", err)
	}

	snsClient := sns.New(session, aws.NewConfig())

	input := &sns.PublishInput{
		Subject:  aws.String(snsNotifier.Subject),
		Message:  aws.String(snsNotifier.Message),
		TopicArn: aws.String(snsNotifier.SnsTopic),
	}
	_, err = snsClient.Publish(input)
	if err != nil {
		snsNotifier.log.Error("Failed to publish to AWS SNS. ", "error", err)
	}

	return true, nil
}

func (snsNotifier *SNSNotifier) SendResolved() bool {
	return !snsNotifier.GetDisableResolveMessage()
}
