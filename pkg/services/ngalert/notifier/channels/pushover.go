package channels

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

var (
	PushoverEndpoint = "https://api.pushover.net/1/messages.json"
)

// PushoverNotifier is responsible for sending
// alert notifications to Pushover
type PushoverNotifier struct {
	*Base
	UserKey          string
	APIToken         string
	AlertingPriority int
	OKPriority       int
	Retry            int
	Expire           int
	Device           string
	AlertingSound    string
	OKSound          string
	Upload           bool
	Message          string
	tmpl             *template.Template
	log              log.Logger
	ns               notifications.WebhookSender
}

type PushoverConfig struct {
	*NotificationChannelConfig
	UserKey          string
	APIToken         string
	AlertingPriority int
	OKPriority       int
	Retry            int
	Expire           int
	Device           string
	AlertingSound    string
	OKSound          string
	Upload           bool
	Message          string
}

func PushoverFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewPushoverConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewPushoverNotifier(cfg, fc.NotificationService, fc.Template), nil
}

func NewPushoverConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*PushoverConfig, error) {
	userKey := decryptFunc(context.Background(), config.SecureSettings, "userKey", config.Settings.Get("userKey").MustString())
	if userKey == "" {
		return nil, errors.New("user key not found")
	}
	APIToken := decryptFunc(context.Background(), config.SecureSettings, "apiToken", config.Settings.Get("apiToken").MustString())
	if APIToken == "" {
		return nil, errors.New("API token not found")
	}
	alertingPriority, err := strconv.Atoi(config.Settings.Get("priority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
	}
	okPriority, err := strconv.Atoi(config.Settings.Get("okPriority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert OK priority to integer: %w", err)
	}
	retry, _ := strconv.Atoi(config.Settings.Get("retry").MustString())
	expire, _ := strconv.Atoi(config.Settings.Get("expire").MustString())
	return &PushoverConfig{
		NotificationChannelConfig: config,
		APIToken:                  APIToken,
		UserKey:                   userKey,
		AlertingPriority:          alertingPriority,
		OKPriority:                okPriority,
		Retry:                     retry,
		Expire:                    expire,
		Device:                    config.Settings.Get("device").MustString(),
		AlertingSound:             config.Settings.Get("sound").MustString(),
		OKSound:                   config.Settings.Get("okSound").MustString(),
		Upload:                    config.Settings.Get("uploadImage").MustBool(true),
		Message:                   config.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
	}, nil
}

// NewSlackNotifier is the constructor for the Slack notifier
func NewPushoverNotifier(config *PushoverConfig, ns notifications.WebhookSender, t *template.Template) *PushoverNotifier {
	return &PushoverNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
			SecureSettings:        config.SecureSettings,
		}),
		UserKey:          config.UserKey,
		APIToken:         config.APIToken,
		AlertingPriority: config.AlertingPriority,
		OKPriority:       config.OKPriority,
		Retry:            config.Retry,
		Expire:           config.Expire,
		Device:           config.Device,
		AlertingSound:    config.AlertingSound,
		OKSound:          config.OKSound,
		Upload:           config.Upload,
		Message:          config.Message,
		tmpl:             t,
		log:              log.New("alerting.notifier.pushover"),
		ns:               ns,
	}
}

// Notify sends an alert notification to Slack.
func (pn *PushoverNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	headers, uploadBody, err := pn.genPushoverBody(ctx, as...)
	if err != nil {
		pn.log.Error("Failed to generate body for pushover", "error", err)
		return false, err
	}

	cmd := &models.SendWebhookSync{
		Url:        PushoverEndpoint,
		HttpMethod: "POST",
		HttpHeader: headers,
		Body:       uploadBody.String(),
	}

	if err := pn.ns.SendWebhookSync(ctx, cmd); err != nil {
		pn.log.Error("Failed to send pushover notification", "error", err, "webhook", pn.Name)
		return false, err
	}

	return true, nil
}
func (pn *PushoverNotifier) SendResolved() bool {
	return !pn.GetDisableResolveMessage()
}

func (pn *PushoverNotifier) genPushoverBody(ctx context.Context, as ...*types.Alert) (map[string]string, bytes.Buffer, error) {
	var b bytes.Buffer

	ruleURL := joinUrlPath(pn.tmpl.ExternalURL.String(), "/alerting/list", pn.log)

	alerts := types.Alerts(as...)

	var tmplErr error
	tmpl, _ := TmplText(ctx, pn.tmpl, as, pn.log, &tmplErr)

	w := multipart.NewWriter(&b)
	boundary := GetBoundary()
	if boundary != "" {
		err := w.SetBoundary(boundary)
		if err != nil {
			return nil, b, err
		}
	}

	// Add the user token
	err := w.WriteField("user", tmpl(pn.UserKey))
	if err != nil {
		return nil, b, err
	}

	// Add the api token
	err = w.WriteField("token", pn.APIToken)
	if err != nil {
		return nil, b, err
	}

	// Add priority
	priority := pn.AlertingPriority
	if alerts.Status() == model.AlertResolved {
		priority = pn.OKPriority
	}
	err = w.WriteField("priority", strconv.Itoa(priority))
	if err != nil {
		return nil, b, err
	}

	if priority == 2 {
		err = w.WriteField("retry", strconv.Itoa(pn.Retry))
		if err != nil {
			return nil, b, err
		}

		err = w.WriteField("expire", strconv.Itoa(pn.Expire))
		if err != nil {
			return nil, b, err
		}
	}

	// Add device
	if pn.Device != "" {
		err = w.WriteField("device", tmpl(pn.Device))
		if err != nil {
			return nil, b, err
		}
	}

	// Add sound
	sound := tmpl(pn.AlertingSound)
	if alerts.Status() == model.AlertResolved {
		sound = tmpl(pn.OKSound)
	}
	if sound != "default" {
		err = w.WriteField("sound", sound)
		if err != nil {
			return nil, b, err
		}
	}

	// Add title
	err = w.WriteField("title", tmpl(DefaultMessageTitleEmbed))
	if err != nil {
		return nil, b, err
	}

	// Add URL
	err = w.WriteField("url", ruleURL)
	if err != nil {
		return nil, b, err
	}
	// Add URL title
	err = w.WriteField("url_title", "Show alert rule")
	if err != nil {
		return nil, b, err
	}

	// Add message
	err = w.WriteField("message", tmpl(pn.Message))
	if err != nil {
		return nil, b, err
	}

	if tmplErr != nil {
		pn.log.Warn("failed to template pushover message", "err", tmplErr.Error())
	}

	// Mark as html message
	err = w.WriteField("html", "1")
	if err != nil {
		return nil, b, err
	}
	if err := w.Close(); err != nil {
		return nil, b, err
	}

	headers := map[string]string{
		"Content-Type": w.FormDataContentType(),
	}

	return headers, b, nil
}
