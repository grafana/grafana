package channels

import (
	"bytes"
	"context"
	"fmt"
	"mime/multipart"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
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
	old_notifiers.NotifierBase
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
}

// NewSlackNotifier is the constructor for the Slack notifier
func NewPushoverNotifier(model *NotificationChannelConfig, t *template.Template) (*PushoverNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No settings supplied"}
	}

	userKey := model.DecryptedValue("userKey", model.Settings.Get("userKey").MustString())
	APIToken := model.DecryptedValue("apiToken", model.Settings.Get("apiToken").MustString())
	device := model.Settings.Get("device").MustString()
	alertingPriority, err := strconv.Atoi(model.Settings.Get("priority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
	}
	okPriority, err := strconv.Atoi(model.Settings.Get("okPriority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert OK priority to integer: %w", err)
	}
	retry, _ := strconv.Atoi(model.Settings.Get("retry").MustString())
	expire, _ := strconv.Atoi(model.Settings.Get("expire").MustString())
	alertingSound := model.Settings.Get("sound").MustString()
	okSound := model.Settings.Get("okSound").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	if userKey == "" {
		return nil, alerting.ValidationError{Reason: "user key not found"}
	}
	if APIToken == "" {
		return nil, alerting.ValidationError{Reason: "API token not found"}
	}
	return &PushoverNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
			SecureSettings:        model.SecureSettings,
		}),
		UserKey:          userKey,
		APIToken:         APIToken,
		AlertingPriority: alertingPriority,
		OKPriority:       okPriority,
		Retry:            retry,
		Expire:           expire,
		Device:           device,
		AlertingSound:    alertingSound,
		OKSound:          okSound,
		Upload:           uploadImage,
		Message:          model.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
		tmpl:             t,
		log:              log.New("alerting.notifier.pushover"),
	}, nil
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

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
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
	err := w.WriteField("user", pn.UserKey)
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
		err = w.WriteField("device", pn.Device)
		if err != nil {
			return nil, b, err
		}
	}

	// Add sound
	sound := pn.AlertingSound
	if alerts.Status() == model.AlertResolved {
		sound = pn.OKSound
	}
	if sound != "default" {
		err = w.WriteField("sound", sound)
		if err != nil {
			return nil, b, err
		}
	}

	// Add title
	err = w.WriteField("title", tmpl(`{{ template "default.title" . }}`))
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
		pn.log.Debug("failed to template pushover message", "err", tmplErr.Error())
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
