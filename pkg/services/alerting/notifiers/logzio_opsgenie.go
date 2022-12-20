package notifiers

// LOGZ.IO GRAFANA CHANGE :: DEV-35483 - Add type for logzio Opsgenie integration

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	OpsGenieAlertUrlForLogzioIntegration = "https://api.opsgenie.com/v1/json/logzio"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "logzio_opsgenie",
		Name:        "OpsGenie",
		Description: "Sends notifications to OpsGenie",
		Heading:     "OpsGenie settings",
		Factory:     NewLogzioOpsGenieNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "API Key",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "OpsGenie API Key",
				PropertyName: "apiKey",
				Required:     true,
				Secure:       true,
			},
			{
				Label:        "Alert API Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://api.opsgenie.com/v2/alerts",
				PropertyName: "apiUrl",
				Required:     true,
			},
		},
	})
}

// NewOpsGenieNotifier is the constructor for OpsGenie.
func NewLogzioOpsGenieNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	apiKey := fn(context.Background(), model.SecureSettings, "apiKey", model.Settings.Get("apiKey").MustString(), setting.SecretKey)
	apiURL := model.Settings.Get("apiUrl").MustString()
	if apiKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find api key property in settings"}
	}
	if apiURL == "" {
		apiURL = OpsGenieAlertUrlForLogzioIntegration
	}

	return &LogzioOpsGenieNotifier{
		NotifierBase: NewNotifierBase(model, ns),
		APIKey:       apiKey,
		APIUrl:       apiURL,
		log:          log.New("alerting.notifier.logzioopsgenie"),
	}, nil
}

// OpsGenieNotifier is responsible for sending
// alert notifications to OpsGenie
type LogzioOpsGenieNotifier struct {
	NotifierBase
	APIKey string
	APIUrl string
	log    log.Logger
}

// Notify sends an alert notification to OpsGenie.
func (on *LogzioOpsGenieNotifier) Notify(_ *alerting.EvalContext) error {
	/**
	This type of notifier is not used in old alerting and is only served for migrating old notification endpoints
	to new contact points.

	This method is never expected to be called
	*/
	return nil
}

// LOGZ.IO GRAFANA CHANGE :: end
