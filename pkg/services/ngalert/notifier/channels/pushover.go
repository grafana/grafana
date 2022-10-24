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
	tmpl     *template.Template
	log      log.Logger
	images   ImageStore
	ns       notifications.WebhookSender
	settings pushoverSettings
}

type pushoverSettings struct {
	*NotificationChannelConfig
	UserKey          string `json:"userKey,omitempty" yaml:"userKey,omitempty"`
	APIToken         string `json:"apiToken,omitempty" yaml:"apiToken,omitempty"`
	alertingPriority int
	okPriority       int
	retry            int
	expire           int
	Device           string `json:"device,omitempty" yaml:"device,omitempty"`
	AlertingSound    string `json:"sound,omitempty" yaml:"sound,omitempty"`
	OKSound          string `json:"okSound,omitempty" yaml:"okSound,omitempty"`
	upload           bool
	Title            string `json:"title,omitempty" yaml:"title,omitempty"`
	Message          string `json:"message,omitempty" yaml:"message,omitempty"`
}

func PushoverFactory(fc FactoryConfig) (NotificationChannel, error) {
	pn, err := newPushoverNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return pn, nil
}

// newSlackNotifier is the constructor for the Slack notifier
func newPushoverNotifier(fc FactoryConfig) (*PushoverNotifier, error) {
	decryptFunc := fc.DecryptFunc
	var settings pushoverSettings
	err := fc.Config.unmarshalSettings(&settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	// If we unmarshalled uploadImage and it was set to "omitempty" it would be defaulted to false.
	settings.upload = fc.Config.Settings.Get("uploadImage").MustBool(true)

	settings.UserKey = decryptFunc(context.Background(), fc.Config.SecureSettings, "userKey", settings.UserKey)
	if settings.UserKey == "" {
		return nil, errors.New("user key not found")
	}
	settings.APIToken = decryptFunc(context.Background(), fc.Config.SecureSettings, "apiToken", settings.APIToken)
	if settings.APIToken == "" {
		return nil, errors.New("API token not found")
	}

	ap, err := strconv.Atoi(fc.Config.Settings.Get("priority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
	}
	settings.alertingPriority = ap
	okp, err := strconv.Atoi(fc.Config.Settings.Get("okPriority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert OK priority to integer: %w", err)
	}
	settings.okPriority = okp
	r, _ := strconv.Atoi(fc.Config.Settings.Get("retry").MustString())
	settings.retry = r
	e, _ := strconv.Atoi(fc.Config.Settings.Get("expire").MustString())
	settings.expire = e

	if settings.Title == "" {
		settings.Title = DefaultMessageTitleEmbed
	}

	if settings.Message == "" {
		settings.Message = DefaultMessageEmbed
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

	if err := w.WriteField("user", tmpl(pn.settings.UserKey)); err != nil {
		return nil, b, fmt.Errorf("failed to write the user: %w", err)
	}

	if err := w.WriteField("token", pn.settings.APIToken); err != nil {
		return nil, b, fmt.Errorf("failed to write the token: %w", err)
	}

	status := types.Alerts(as...).Status()
	priority := pn.settings.alertingPriority
	if status == model.AlertResolved {
		priority = pn.settings.okPriority
	}
	if err := w.WriteField("priority", strconv.Itoa(priority)); err != nil {
		return nil, b, fmt.Errorf("failed to write the priority: %w", err)
	}

	if priority == 2 {
		if err := w.WriteField("retry", strconv.Itoa(pn.settings.retry)); err != nil {
			return nil, b, fmt.Errorf("failed to write retry: %w", err)
		}

		if err := w.WriteField("expire", strconv.Itoa(pn.settings.expire)); err != nil {
			return nil, b, fmt.Errorf("failed to write expire: %w", err)
		}
	}

	if pn.settings.Device != "" {
		if err := w.WriteField("device", tmpl(pn.settings.Device)); err != nil {
			return nil, b, fmt.Errorf("failed to write the device: %w", err)
		}
	}

	if err := w.WriteField("title", tmpl(pn.settings.Title)); err != nil {
		return nil, b, fmt.Errorf("failed to write the title: %w", err)
	}

	ruleURL := joinUrlPath(pn.tmpl.ExternalURL.String(), "/alerting/list", pn.log)
	if err := w.WriteField("url", ruleURL); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL: %w", err)
	}

	if err := w.WriteField("url_title", "Show alert rule"); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL title: %w", err)
	}

	if err := w.WriteField("message", tmpl(pn.settings.Message)); err != nil {
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
		sound = tmpl(pn.settings.OKSound)
	} else {
		sound = tmpl(pn.settings.AlertingSound)
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
