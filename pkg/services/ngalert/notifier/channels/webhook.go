package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

// WebhookNotifier is responsible for sending
// alert notifications as webhooks.
type WebhookNotifier struct {
	*Base
	log       log.Logger
	ns        notifications.WebhookSender
	images    ImageStore
	tmpl      *template.Template
	orgID     int64
	maxAlerts int
	settings  webhookSettings
}

type webhookSettings struct {
	URL        string      `json:"url,omitempty" yaml:"url,omitempty"`
	HTTPMethod string      `json:"httpMethod,omitempty" yaml:"httpMethod,omitempty"`
	MaxAlerts  interface{} `json:"maxAlerts,omitempty" yaml:"maxAlerts,omitempty"`

	// Authorization Header.
	AuthorizationScheme      string `json:"authorization_scheme,omitempty" yaml:"authorization_scheme,omitempty"`
	AuthorizationCredentials string `json:"authorization_credentials,omitempty" yaml:"authorization_credentials,omitempty"`
	// HTTP Basic Authentication.
	User     string `json:"username,omitempty" yaml:"username,omitempty"`
	Password string `json:"password,omitempty" yaml:"password,omitempty"`

	Title   string `json:"title,omitempty" yaml:"title,omitempty"`
	Message string `json:"message,omitempty" yaml:"message,omitempty"`
}

func buildWebhookSettings(factoryConfig FactoryConfig) (webhookSettings, error) {
	settings := webhookSettings{}
	err := factoryConfig.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.URL == "" {
		return settings, errors.New("required field 'url' is not specified")
	}
	if settings.HTTPMethod == "" {
		settings.HTTPMethod = http.MethodPost
	}
	settings.User = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "username", settings.User)
	settings.Password = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "password", settings.Password)
	settings.AuthorizationCredentials = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "authorization_scheme", settings.AuthorizationCredentials)
	if settings.AuthorizationCredentials != "" && settings.AuthorizationScheme == "" {
		settings.AuthorizationScheme = "Bearer"
	}
	if settings.User != "" && settings.Password != "" && settings.AuthorizationScheme != "" && settings.AuthorizationCredentials != "" {
		return settings, errors.New("both HTTP Basic Authentication and Authorization Header are set, only 1 is permitted")
	}
	if settings.Title == "" {
		settings.Title = DefaultMessageTitleEmbed
	}
	if settings.Message == "" {
		settings.Message = DefaultMessageEmbed
	}
	return settings, err
}

func WebHookFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := buildWebhookNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// buildWebhookNotifier is the constructor for
// the WebHook notifier.
func buildWebhookNotifier(factoryConfig FactoryConfig) (*WebhookNotifier, error) {
	settings, err := buildWebhookSettings(factoryConfig)
	if err != nil {
		return nil, err
	}

	logger := log.New(factoryConfig.Config.LogContext("alerting.notifier.webhook")...)
	maxAlerts := 0
	if settings.MaxAlerts != nil {
		switch value := settings.MaxAlerts.(type) {
		case int:
			maxAlerts = value
		case string:
			maxAlerts, err = strconv.Atoi(value)
			if err != nil {
				logger.Warn("failed to convert setting maxAlerts to integer. Using default", "error", err, "original", value)
				maxAlerts = 0
			}
		default:
			logger.Warn("unexpected type of setting maxAlerts. Expected integer. Using default", "type", fmt.Sprintf("%T", settings.MaxAlerts))
		}
	}

	return &WebhookNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   factoryConfig.Config.UID,
			Name:                  factoryConfig.Config.Name,
			Type:                  factoryConfig.Config.Type,
			DisableResolveMessage: factoryConfig.Config.DisableResolveMessage,
			Settings:              factoryConfig.Config.Settings,
		}),
		orgID:     factoryConfig.Config.OrgID,
		log:       logger,
		ns:        factoryConfig.NotificationService,
		images:    factoryConfig.ImageStore,
		tmpl:      factoryConfig.Template,
		maxAlerts: maxAlerts,
		settings:  settings,
	}, nil
}

// WebhookMessage defines the JSON object send to webhook endpoints.
type WebhookMessage struct {
	*ExtendedData

	// The protocol version.
	Version         string `json:"version"`
	GroupKey        string `json:"groupKey"`
	TruncatedAlerts int    `json:"truncatedAlerts"`
	OrgID           int64  `json:"orgId"`
	Title           string `json:"title"`
	State           string `json:"state"`
	Message         string `json:"message"`
}

// Notify implements the Notifier interface.
func (wn *WebhookNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	as, numTruncated := truncateAlerts(wn.maxAlerts, as)
	var tmplErr error
	tmpl, data := TmplText(ctx, wn.tmpl, as, wn.log, &tmplErr)

	// Augment our Alert data with ImageURLs if available.
	_ = withStoredImages(ctx, wn.log, wn.images,
		func(index int, image ngmodels.Image) error {
			if len(image.URL) != 0 {
				data.Alerts[index].ImageURL = image.URL
			}
			return nil
		},
		as...)

	msg := &WebhookMessage{
		Version:         "1",
		ExtendedData:    data,
		GroupKey:        groupKey.String(),
		TruncatedAlerts: numTruncated,
		OrgID:           wn.orgID,
		Title:           tmpl(wn.settings.Title),
		Message:         tmpl(wn.settings.Message),
	}
	if types.Alerts(as...).Status() == model.AlertFiring {
		msg.State = string(models.AlertStateAlerting)
	} else {
		msg.State = string(models.AlertStateOK)
	}

	if tmplErr != nil {
		wn.log.Warn("failed to template webhook message", "error", tmplErr.Error())
		tmplErr = nil
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return false, err
	}

	headers := make(map[string]string)
	if wn.settings.AuthorizationScheme != "" && wn.settings.AuthorizationCredentials != "" {
		headers["Authorization"] = fmt.Sprintf("%s %s", wn.settings.AuthorizationScheme, wn.settings.AuthorizationCredentials)
	}

	parsedURL := tmpl(wn.settings.URL)
	if tmplErr != nil {
		return false, tmplErr
	}

	cmd := &models.SendWebhookSync{
		Url:        parsedURL,
		User:       wn.settings.User,
		Password:   wn.settings.Password,
		Body:       string(body),
		HttpMethod: wn.settings.HTTPMethod,
		HttpHeader: headers,
	}

	if err := wn.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func truncateAlerts(maxAlerts int, alerts []*types.Alert) ([]*types.Alert, int) {
	if maxAlerts > 0 && len(alerts) > maxAlerts {
		return alerts[:maxAlerts], len(alerts) - maxAlerts
	}

	return alerts, 0
}

func (wn *WebhookNotifier) SendResolved() bool {
	return !wn.GetDisableResolveMessage()
}
