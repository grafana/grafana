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
	userKey          string
	apiToken         string
	alertingPriority int
	okPriority       int
	retry            int
	expire           int
	device           string
	alertingSound    string
	okSound          string
	upload           bool
	title            string
	message          string
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

// newPushoverNotifier is the constructor for the Pushover notifier
func newPushoverNotifier(fc FactoryConfig) (*PushoverNotifier, error) {
	decryptFunc := fc.DecryptFunc
	userKey := decryptFunc(context.Background(), fc.Config.SecureSettings, "userKey", fc.Config.Settings.Get("userKey").MustString())
	if userKey == "" {
		return nil, errors.New("user key not found")
	}
	apiToken := decryptFunc(context.Background(), fc.Config.SecureSettings, "apiToken", fc.Config.Settings.Get("apiToken").MustString())
	if apiToken == "" {
		return nil, errors.New("API token not found")
	}

	alertingPriority, err := strconv.Atoi(fc.Config.Settings.Get("priority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
	}
	okPriority, err := strconv.Atoi(fc.Config.Settings.Get("okPriority").MustString("0")) // default Normal
	if err != nil {
		return nil, fmt.Errorf("failed to convert OK priority to integer: %w", err)
	}
	retry, _ := strconv.Atoi(fc.Config.Settings.Get("retry").MustString())
	expire, _ := strconv.Atoi(fc.Config.Settings.Get("expire").MustString())

	return &PushoverNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
			SecureSettings:        fc.Config.SecureSettings,
		}),
		tmpl:   fc.Template,
		log:    log.New("alerting.notifier.pushover"),
		images: fc.ImageStore,
		ns:     fc.NotificationService,
		settings: pushoverSettings{
			userKey:          userKey,
			apiToken:         apiToken,
			alertingPriority: alertingPriority,
			okPriority:       okPriority,
			retry:            retry,
			expire:           expire,
			device:           fc.Config.Settings.Get("device").MustString(),
			alertingSound:    fc.Config.Settings.Get("sound").MustString(),
			okSound:          fc.Config.Settings.Get("okSound").MustString(),
			upload:           fc.Config.Settings.Get("uploadImage").MustBool(true),
			title:            fc.Config.Settings.Get("title").MustString(DefaultMessageTitleEmbed),
			message:          fc.Config.Settings.Get("message").MustString(DefaultMessageEmbed),
		},
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

	if pn.settings.device != "" {
		if err := w.WriteField("device", tmpl(pn.settings.device)); err != nil {
			return nil, b, fmt.Errorf("failed to write the device: %w", err)
		}
	}

	if err := w.WriteField("title", tmpl(pn.settings.title)); err != nil {
		return nil, b, fmt.Errorf("failed to write the title: %w", err)
	}

	ruleURL := joinUrlPath(pn.tmpl.ExternalURL.String(), "/alerting/list", pn.log)
	if err := w.WriteField("url", ruleURL); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL: %w", err)
	}

	if err := w.WriteField("url_title", "Show alert rule"); err != nil {
		return nil, b, fmt.Errorf("failed to write the URL title: %w", err)
	}

	if err := w.WriteField("message", tmpl(pn.settings.message)); err != nil {
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
