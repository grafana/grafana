package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

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
	URL        string
	HTTPMethod string
	MaxAlerts  int
	log        log.Logger
	ns         notifications.WebhookSender
	images     ImageStore
	tmpl       *template.Template
	orgID      int64

	User     string
	Password string

	AuthorizationScheme      string
	AuthorizationCredentials string
}

type WebhookConfig struct {
	*NotificationChannelConfig
	URL        string
	HTTPMethod string
	MaxAlerts  int

	// Authorization Header.
	AuthorizationScheme      string
	AuthorizationCredentials string
	// HTTP Basic Authentication.
	User     string
	Password string
}

func WebHookFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewWebHookConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewWebHookNotifier(cfg, fc.NotificationService, fc.ImageStore, fc.Template), nil
}

func NewWebHookConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*WebhookConfig, error) {
	url := config.Settings.Get("url").MustString()
	if url == "" {
		return nil, errors.New("could not find url property in settings")
	}

	user := config.Settings.Get("username").MustString()
	password := decryptFunc(context.Background(), config.SecureSettings, "password", config.Settings.Get("password").MustString())
	authorizationScheme := config.Settings.Get("authorization_scheme").MustString("Bearer")
	authorizationCredentials := decryptFunc(context.Background(), config.SecureSettings, "authorization_credentials", config.Settings.Get("authorization_credentials").MustString())

	if user != "" && password != "" && authorizationScheme != "" && authorizationCredentials != "" {
		return nil, errors.New("both HTTP Basic Authentication and Authorization Header are set, only 1 is permitted")
	}

	return &WebhookConfig{
		NotificationChannelConfig: config,
		URL:                       url,
		User:                      user,
		Password:                  password,
		AuthorizationScheme:       authorizationScheme,
		AuthorizationCredentials:  authorizationCredentials,
		HTTPMethod:                config.Settings.Get("httpMethod").MustString("POST"),
		MaxAlerts:                 config.Settings.Get("maxAlerts").MustInt(0),
	}, nil
}

// NewWebHookNotifier is the constructor for
// the WebHook notifier.
func NewWebHookNotifier(config *WebhookConfig, ns notifications.WebhookSender, images ImageStore, t *template.Template) *WebhookNotifier {
	return &WebhookNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		orgID:                    config.OrgID,
		URL:                      config.URL,
		User:                     config.User,
		Password:                 config.Password,
		AuthorizationScheme:      config.AuthorizationScheme,
		AuthorizationCredentials: config.AuthorizationCredentials,
		HTTPMethod:               config.HTTPMethod,
		MaxAlerts:                config.MaxAlerts,
		log:                      log.New("alerting.notifier.webhook"),
		ns:                       ns,
		images:                   images,
		tmpl:                     t,
	}
}

// WebhookMessage defines the JSON object send to webhook endpoints.
type WebhookMessage struct {
	*ExtendedData

	// The protocol version.
	Version         string `json:"version"`
	GroupKey        string `json:"groupKey"`
	TruncatedAlerts int    `json:"truncatedAlerts"`
	OrgID           int64  `json:"orgId"`

	// Deprecated, to be removed in 8.1.
	// These are present to make migration a little less disruptive.
	Title   string `json:"title"`
	State   string `json:"state"`
	Message string `json:"message"`
}

// Notify implements the Notifier interface.
func (wn *WebhookNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	as, numTruncated := truncateAlerts(wn.MaxAlerts, as)
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
		Title:           tmpl(DefaultMessageTitleEmbed),
		Message:         tmpl(DefaultMessageEmbed),
	}
	if types.Alerts(as...).Status() == model.AlertFiring {
		msg.State = string(models.AlertStateAlerting)
	} else {
		msg.State = string(models.AlertStateOK)
	}

	if tmplErr != nil {
		wn.log.Warn("failed to template webhook message", "err", tmplErr.Error())
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return false, err
	}

	headers := make(map[string]string)
	if wn.AuthorizationScheme != "" && wn.AuthorizationCredentials != "" {
		headers["Authorization"] = fmt.Sprintf("%s %s", wn.AuthorizationScheme, wn.AuthorizationCredentials)
	}

	cmd := &models.SendWebhookSync{
		Url:        wn.URL,
		User:       wn.User,
		Password:   wn.Password,
		Body:       string(body),
		HttpMethod: wn.HTTPMethod,
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
