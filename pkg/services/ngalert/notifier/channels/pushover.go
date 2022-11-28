package channels

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"strconv"

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
	images           ImageStore
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
	return NewPushoverNotifier(cfg, fc.ImageStore, fc.NotificationService, fc.Template), nil
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
		Message:                   config.Settings.Get("message").MustString(DefaultMessageEmbed),
	}, nil
}

// NewSlackNotifier is the constructor for the Slack notifier
func NewPushoverNotifier(config *PushoverConfig, images ImageStore,
	ns notifications.WebhookSender, t *template.Template) *PushoverNotifier {
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
		images:           images,
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
		pn.log.Error("failed to send pushover notification", "err", err, "webhook", pn.Name)
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

	if err := w.WriteField("user", tmpl(pn.UserKey)); err != nil {
		return nil, b, fmt.Errorf("failed to write the user: %w", err)
	}

	if err := w.WriteField("token", pn.APIToken); err != nil {
		return nil, b, fmt.Errorf("failed to write the token: %w", err)
	}

	status := types.Alerts(as...).Status()
	priority := pn.AlertingPriority
	if status == model.AlertResolved {
		priority = pn.OKPriority
	}
	if err := w.WriteField("priority", strconv.Itoa(priority)); err != nil {
		return nil, b, fmt.Errorf("failed to write the priority: %w", err)
	}

	if priority == 2 {
		if err := w.WriteField("retry", strconv.Itoa(pn.Retry)); err != nil {
			return nil, b, fmt.Errorf("failed to write retry: %w", err)
		}

		if err := w.WriteField("expire", strconv.Itoa(pn.Expire)); err != nil {
			return nil, b, fmt.Errorf("failed to write expire: %w", err)
		}
	}

	if pn.Device != "" {
		if err := w.WriteField("device", tmpl(pn.Device)); err != nil {
			return nil, b, fmt.Errorf("failed to write the device: %w", err)
		}
	}

	if err := w.WriteField("title", tmpl(DefaultMessageTitleEmbed)); err != nil {
		return nil, b, fmt.Errorf("failed to write the title: %w", err)
	}

	ruleURL := joinUrlPath(pn.tmpl.ExternalURL.String(), "/alerting/list", pn.log)
	if err := w.WriteField("url", ruleURL); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL: %w", err)
	}

	if err := w.WriteField("url_title", "Show alert rule"); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL title: %w", err)
	}

	if err := w.WriteField("message", tmpl(pn.Message)); err != nil {
		return nil, b, fmt.Errorf("failed write the message: %w", err)
	}

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

	var sound string
	if status == model.AlertResolved {
		sound = tmpl(pn.OKSound)
	} else {
		sound = tmpl(pn.AlertingSound)
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
		pn.log.Warn("failed to template pushover message", "err", tmplErr.Error())
	}

	headers := map[string]string{
		"Content-Type": w.FormDataContentType(),
	}

	return headers, b, nil
}
