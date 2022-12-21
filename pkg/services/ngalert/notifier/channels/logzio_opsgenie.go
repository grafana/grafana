package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"net/http"
)

// LOGZ.IO GRAFANA CHANGE :: DEV-35483 - Add type for logzio Opsgenie integration

const (
	OpsGenieAlertUrlForLogzioIntegration = "https://api.opsgenie.com/v1/json/logzio"
)

type LogzioOpsgenieNotifier struct {
	*Base
	APIUrl string
	APIKey string
	log    log.Logger
	tmpl   *template.Template
	ns     notifications.WebhookSender
}

type LogzioOpsgenieConfig struct {
	*NotificationChannelConfig
	APIKey string
	APIUrl string
}

func LogzioOpsgenieFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewLogzioOpsgenieConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewLogzioOpsgenieNotifier(cfg, fc.NotificationService, fc.Template), nil
}

func NewLogzioOpsgenieConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*LogzioOpsgenieConfig, error) {
	apiKey := decryptFunc(context.Background(), config.SecureSettings, "apiKey", config.Settings.Get("apiKey").MustString())
	if apiKey == "" {
		return nil, errors.New("could not find api key property in settings")
	}
	apiUrl := config.Settings.Get("apiUrl").MustString(OpsGenieAlertUrlForLogzioIntegration)

	return &LogzioOpsgenieConfig{
		NotificationChannelConfig: config,
		APIKey:                    apiKey,
		APIUrl:                    apiUrl,
	}, nil
}

// NewOpsgenieNotifier is the constructor for the Opsgenie notifier
func NewLogzioOpsgenieNotifier(config *LogzioOpsgenieConfig, ns notifications.WebhookSender, t *template.Template) *LogzioOpsgenieNotifier {
	return &LogzioOpsgenieNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		APIKey: config.APIKey,
		APIUrl: config.APIUrl,
		tmpl:   t,
		log:    log.New("alerting.notifier." + config.Name),
		ns:     ns,
	}
}

func (on *LogzioOpsgenieNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	on.log.Debug("Executing Opsgenie (Logzio Integration) notification", "notification", on.Name)

	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !on.SendResolved() {
		on.log.Debug("Not sending a trigger to Opsgenie", "status", alerts.Status(), "auto resolve", on.SendResolved())
		return true, nil
	}

	bodyJSON, err := on.buildOpsgenieMessage(ctx, alerts, as)
	if err != nil {
		return false, fmt.Errorf("build Opsgenie message: %w", err)
	}

	body, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	url := fmt.Sprintf("%s?apiKey=%s", on.APIUrl, on.APIKey)

	cmd := &models.SendWebhookSync{
		Url:        url,
		Body:       string(body),
		HttpMethod: http.MethodPost,
		HttpHeader: map[string]string{
			"Content-Type": "application/json",
		},
	}

	if err := on.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, fmt.Errorf("send notification to Opsgenie (Logzio Integration): %w", err)
	}

	return true, nil
}

func (on *LogzioOpsgenieNotifier) buildOpsgenieMessage(ctx context.Context, alerts model.Alerts, as []*types.Alert) (payload *simplejson.Json, err error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return nil, err
	}

	var (
		alias    = key.Hash()
		bodyJSON = simplejson.New()
		details  = simplejson.New()
	)

	if alerts.Status() == model.AlertResolved {
		bodyJSON := simplejson.New()
		bodyJSON.Set("alert_alias", alias)
		bodyJSON.Set("alert_event_type", "close")
		return bodyJSON, nil
	}

	rulePageURL := ToLogzioAppPath(joinUrlPath(on.tmpl.ExternalURL.String(), "/alerting/list", on.log))

	var tmplErr error
	tmpl, data := TmplText(ctx, on.tmpl, as, on.log, &tmplErr)

	var title string
	var valueString string
	var alertViewUrl string

	if len(as) == 1 {
		title = as[0].Name()
		valueString = string(as[0].Annotations[`__value_string__`])
		alertViewUrl = as[0].GeneratorURL
	} else {
		title = tmpl(DefaultMessageTitleEmbed)
		alertViewUrl = rulePageURL
	}

	description := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(DefaultMessageTitleEmbed),
		rulePageURL,
		tmpl(`{{ template "default.message" . }}`),
	)

	// In the new alerting system we've moved away from the grafana-tags. Instead, annotations on the rule itself should be used.
	lbls := make(map[string]string, len(data.CommonLabels))
	for k, v := range data.CommonLabels {
		lbls[k] = tmpl(v)
	}

	bodyJSON.Set("alert_title", title)
	bodyJSON.Set("alert_description", description)
	bodyJSON.Set("alert_alias", alias)

	if valueString != "" {
		bodyJSON.Set("alert_event_samples", valueString)
	}
	bodyJSON.Set("alert_event_type", "create")

	details.Set("url", alertViewUrl)
	for k, v := range lbls {
		details.Set(k, v)
	}

	bodyJSON.Set("alert_details", details)
	bodyJSON.Set("alert_view_link", alertViewUrl)

	if tmplErr != nil {
		on.log.Warn("failed to template Opsgenie message (Logzio Integration)", "err", tmplErr.Error())
	}

	return bodyJSON, nil
}

func (on *LogzioOpsgenieNotifier) SendResolved() bool {
	return !on.GetDisableResolveMessage()
}

// LOGZ.IO GRAFANA CHANGE :: end
