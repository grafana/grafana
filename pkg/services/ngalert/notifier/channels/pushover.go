package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strconv"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

const (
	pushoverMaxFileSize = 1 << 21 // 2MB
	// https://pushover.net/api#limits - 250 characters or runes.
	pushoverMaxTitleLenRunes = 250
	// https://pushover.net/api#limits - 1024 characters or runes.
	pushoverMaxMessageLenRunes = 1024
	// https://pushover.net/api#limits - 512 characters or runes.
	pushoverMaxURLLenRunes = 512
)

var (
	PushoverEndpoint = "https://api.pushover.net/1/messages.json"
)

// PushoverNotifier is responsible for sending
// alert notifications to Pushover
type PushoverNotifier struct {
	*Base
	tmpl     *template.Template
	log      log.Logger
	images   ImageStore
	ns       notifications.WebhookSender
	settings pushoverSettings
}

type pushoverSettings struct {
	userKey          string
	apiToken         string
	alertingPriority int64
	okPriority       int64
	retry            int64
	expire           int64
	device           string
	alertingSound    string
	okSound          string
	upload           bool
	title            string
	message          string
}

func buildPushoverSettings(fc FactoryConfig) (pushoverSettings, error) {
	settings := pushoverSettings{}
	rawSettings := struct {
		UserKey          string      `json:"userKey,omitempty" yaml:"userKey,omitempty"`
		APIToken         string      `json:"apiToken,omitempty" yaml:"apiToken,omitempty"`
		AlertingPriority json.Number `json:"priority,omitempty" yaml:"priority,omitempty"`
		OKPriority       json.Number `json:"okPriority,omitempty" yaml:"okPriority,omitempty"`
		Retry            json.Number `json:"retry,omitempty" yaml:"retry,omitempty"`
		Expire           json.Number `json:"expire,omitempty" yaml:"expire,omitempty"`
		Device           string      `json:"device,omitempty" yaml:"device,omitempty"`
		AlertingSound    string      `json:"sound,omitempty" yaml:"sound,omitempty"`
		OKSound          string      `json:"okSound,omitempty" yaml:"okSound,omitempty"`
		Upload           *bool       `json:"uploadImage,omitempty" yaml:"uploadImage,omitempty"`
		Title            string      `json:"title,omitempty" yaml:"title,omitempty"`
		Message          string      `json:"message,omitempty" yaml:"message,omitempty"`
	}{}

	err := fc.Config.unmarshalSettings(&rawSettings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	settings.userKey = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "userKey", rawSettings.UserKey)
	if settings.userKey == "" {
		return settings, errors.New("user key not found")
	}
	settings.apiToken = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "apiToken", rawSettings.APIToken)
	if settings.apiToken == "" {
		return settings, errors.New("API token not found")
	}
	if rawSettings.AlertingPriority != "" {
		settings.alertingPriority, err = rawSettings.AlertingPriority.Int64()
		if err != nil {
			return settings, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
		}
	}

	if rawSettings.OKPriority != "" {
		settings.okPriority, err = rawSettings.OKPriority.Int64()
		if err != nil {
			return settings, fmt.Errorf("failed to convert OK priority to integer: %w", err)
		}
	}

	settings.retry, _ = rawSettings.Retry.Int64()
	settings.expire, _ = rawSettings.Expire.Int64()

	settings.device = rawSettings.Device
	settings.alertingSound = rawSettings.AlertingSound
	settings.okSound = rawSettings.OKSound

	if rawSettings.Upload == nil || *rawSettings.Upload {
		settings.upload = true
	}

	settings.message = rawSettings.Message
	if settings.message == "" {
		settings.message = DefaultMessageEmbed
	}

	settings.title = rawSettings.Title
	if settings.title == "" {
		settings.title = DefaultMessageTitleEmbed
	}

	return settings, nil
}

func PushoverFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := NewPushoverNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// NewSlackNotifier is the constructor for the Slack notifier
func NewPushoverNotifier(fc FactoryConfig) (*PushoverNotifier, error) {
	settings, err := buildPushoverSettings(fc)
	if err != nil {
		return nil, err
	}
	return &PushoverNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
			SecureSettings:        fc.Config.SecureSettings,
		}),
		tmpl:     fc.Template,
		log:      log.New("alerting.notifier.pushover"),
		images:   fc.ImageStore,
		ns:       fc.NotificationService,
		settings: settings,
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

	if err := pn.ns.SendWebhookSync(ctx, cmd); err != nil {
		pn.log.Error("failed to send pushover notification", "error", err, "webhook", pn.Name)
		return false, err
	}

	return true, nil
}
func (pn *PushoverNotifier) SendResolved() bool {
	return !pn.GetDisableResolveMessage()
}

func (pn *PushoverNotifier) genPushoverBody(ctx context.Context, as ...*types.Alert) (map[string]string, bytes.Buffer, error) {
	b := bytes.Buffer{}
	w := multipart.NewWriter(&b)

	// tests use a non-random boundary separator
	if boundary := GetBoundary(); boundary != "" {
		err := w.SetBoundary(boundary)
		if err != nil {
			return nil, b, err
		}
	}

	var tmplErr error
	tmpl, _ := TmplText(ctx, pn.tmpl, as, pn.log, &tmplErr)

	if err := w.WriteField("user", tmpl(pn.settings.userKey)); err != nil {
		return nil, b, fmt.Errorf("failed to write the user: %w", err)
	}

	if err := w.WriteField("token", pn.settings.apiToken); err != nil {
		return nil, b, fmt.Errorf("failed to write the token: %w", err)
	}

	title, truncated := TruncateInRunes(tmpl(pn.settings.title), pushoverMaxTitleLenRunes)
	if truncated {
		pn.log.Warn("Truncated title", "runes", pushoverMaxTitleLenRunes)
	}
	message := tmpl(pn.settings.message)
	message, truncated = TruncateInRunes(message, pushoverMaxMessageLenRunes)
	if truncated {
		pn.log.Warn("Truncated message", "runes", pushoverMaxMessageLenRunes)
	}
	message = strings.TrimSpace(message)
	if message == "" {
		// Pushover rejects empty messages.
		message = "(no details)"
	}

	supplementaryURL := joinUrlPath(pn.tmpl.ExternalURL.String(), "/alerting/list", pn.log)
	supplementaryURL, truncated = TruncateInRunes(supplementaryURL, pushoverMaxURLLenRunes)
	if truncated {
		pn.log.Warn("Truncated URL", "runes", pushoverMaxURLLenRunes)
	}

	status := types.Alerts(as...).Status()
	priority := pn.settings.alertingPriority
	if status == model.AlertResolved {
		priority = pn.settings.okPriority
	}
	if err := w.WriteField("priority", strconv.FormatInt(priority, 10)); err != nil {
		return nil, b, fmt.Errorf("failed to write the priority: %w", err)
	}

	if priority == 2 {
		if err := w.WriteField("retry", strconv.FormatInt(pn.settings.retry, 10)); err != nil {
			return nil, b, fmt.Errorf("failed to write retry: %w", err)
		}

		if err := w.WriteField("expire", strconv.FormatInt(pn.settings.expire, 10)); err != nil {
			return nil, b, fmt.Errorf("failed to write expire: %w", err)
		}
	}

	if pn.settings.device != "" {
		if err := w.WriteField("device", tmpl(pn.settings.device)); err != nil {
			return nil, b, fmt.Errorf("failed to write the device: %w", err)
		}
	}

	if err := w.WriteField("title", title); err != nil {
		return nil, b, fmt.Errorf("failed to write the title: %w", err)
	}

	if err := w.WriteField("url", supplementaryURL); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL: %w", err)
	}

	if err := w.WriteField("url_title", "Show alert rule"); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL title: %w", err)
	}

	if err := w.WriteField("message", message); err != nil {
		return nil, b, fmt.Errorf("failed write the message: %w", err)
	}

	pn.writeImageParts(ctx, w, as...)

	var sound string
	if status == model.AlertResolved {
		sound = tmpl(pn.settings.okSound)
	} else {
		sound = tmpl(pn.settings.alertingSound)
	}
	if sound != "default" {
		if err := w.WriteField("sound", sound); err != nil {
			return nil, b, fmt.Errorf("failed to write the sound: %w", err)
		}
	}

	// Mark the message as HTML
	if err := w.WriteField("html", "1"); err != nil {
		return nil, b, fmt.Errorf("failed to mark the message as HTML: %w", err)
	}
	if err := w.Close(); err != nil {
		return nil, b, fmt.Errorf("failed to close the multipart request: %w", err)
	}

	if tmplErr != nil {
		pn.log.Warn("failed to template pushover message", "error", tmplErr.Error())
	}

	headers := map[string]string{
		"Content-Type": w.FormDataContentType(),
	}

	return headers, b, nil
}

func (pn *PushoverNotifier) writeImageParts(ctx context.Context, w *multipart.Writer, as ...*types.Alert) {
	// Pushover supports at most one image attachment with a maximum size of pushoverMaxFileSize.
	// If the image is larger than pushoverMaxFileSize then return an error.
	_ = withStoredImages(ctx, pn.log, pn.images, func(index int, image ngmodels.Image) error {
		f, err := os.Open(image.Path)
		if err != nil {
			return fmt.Errorf("failed to open the image: %w", err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				pn.log.Error("failed to close the image", "file", image.Path)
			}
		}()

		fileInfo, err := f.Stat()
		if err != nil {
			return fmt.Errorf("failed to stat the image: %w", err)
		}

		if fileInfo.Size() > pushoverMaxFileSize {
			return fmt.Errorf("image would exceeded maximum file size: %d", fileInfo.Size())
		}

		fw, err := w.CreateFormFile("attachment", image.Path)
		if err != nil {
			return fmt.Errorf("failed to create form file for the image: %w", err)
		}

		if _, err = io.Copy(fw, f); err != nil {
			return fmt.Errorf("failed to copy the image to the form file: %w", err)
		}

		return ErrImagesDone
	}, as...)
}
