package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/alerting/alerting/notifier/channels"
)

// EmailNotifier is responsible for sending
// alert notifications over email.
type EmailNotifier struct {
	*channels.Base
	log      channels.Logger
	ns       channels.EmailSender
	images   channels.ImageStore
	tmpl     *template.Template
	settings *emailSettings
}

type emailSettings struct {
	SingleEmail bool
	Addresses   []string
	Message     string
	Subject     string
}

func EmailFactory(fc channels.FactoryConfig) (channels.NotificationChannel, error) {
	notifier, err := buildEmailNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

func buildEmailSettings(fc channels.FactoryConfig) (*emailSettings, error) {
	type emailSettingsRaw struct {
		SingleEmail bool   `json:"singleEmail,omitempty"`
		Addresses   string `json:"addresses,omitempty"`
		Message     string `json:"message,omitempty"`
		Subject     string `json:"subject,omitempty"`
	}

	var settings emailSettingsRaw
	err := json.Unmarshal(fc.Config.Settings, &settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.Addresses == "" {
		return nil, errors.New("could not find addresses in settings")
	}
	// split addresses with a few different ways
	addresses := splitEmails(settings.Addresses)

	if settings.Subject == "" {
		settings.Subject = channels.DefaultMessageTitleEmbed
	}

	return &emailSettings{
		SingleEmail: settings.SingleEmail,
		Message:     settings.Message,
		Subject:     settings.Subject,
		Addresses:   addresses,
	}, nil
}

// NewEmailNotifier is the constructor function
// for the EmailNotifier.
func buildEmailNotifier(fc channels.FactoryConfig) (*EmailNotifier, error) {
	settings, err := buildEmailSettings(fc)
	if err != nil {
		return nil, err
	}
	return &EmailNotifier{
		Base:     channels.NewBase(fc.Config),
		log:      fc.Logger,
		ns:       fc.NotificationService,
		images:   fc.ImageStore,
		tmpl:     fc.Template,
		settings: settings,
	}, nil
}

// Notify sends the alert notification.
func (en *EmailNotifier) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, data := channels.TmplText(ctx, en.tmpl, alerts, en.log, &tmplErr)

	subject := tmpl(en.settings.Subject)
	alertPageURL := en.tmpl.ExternalURL.String()
	ruleURL := en.tmpl.ExternalURL.String()
	u, err := url.Parse(en.tmpl.ExternalURL.String())
	if err == nil {
		basePath := u.Path
		u.Path = path.Join(basePath, "/alerting/list")
		ruleURL = u.String()
		u.RawQuery = "alertState=firing&view=state"
		alertPageURL = u.String()
	} else {
		en.log.Debug("failed to parse external URL", "url", en.tmpl.ExternalURL.String(), "error", err.Error())
	}

	// Extend alerts data with images, if available.
	var embeddedFiles []string
	_ = withStoredImages(ctx, en.log, en.images,
		func(index int, image channels.Image) error {
			if len(image.URL) != 0 {
				data.Alerts[index].ImageURL = image.URL
			} else if len(image.Path) != 0 {
				_, err := os.Stat(image.Path)
				if err == nil {
					data.Alerts[index].EmbeddedImage = filepath.Base(image.Path)
					embeddedFiles = append(embeddedFiles, image.Path)
				} else {
					en.log.Warn("failed to get image file for email attachment", "file", image.Path, "error", err)
				}
			}
			return nil
		}, alerts...)

	cmd := &channels.SendEmailSettings{
		Subject: subject,
		Data: map[string]interface{}{
			"Title":             subject,
			"Message":           tmpl(en.settings.Message),
			"Status":            data.Status,
			"Alerts":            data.Alerts,
			"GroupLabels":       data.GroupLabels,
			"CommonLabels":      data.CommonLabels,
			"CommonAnnotations": data.CommonAnnotations,
			"ExternalURL":       data.ExternalURL,
			"RuleUrl":           ruleURL,
			"AlertPageUrl":      alertPageURL,
		},
		EmbeddedFiles: embeddedFiles,
		To:            en.settings.Addresses,
		SingleEmail:   en.settings.SingleEmail,
		Template:      "ng_alert_notification",
	}

	if tmplErr != nil {
		en.log.Warn("failed to template email message", "error", tmplErr.Error())
	}

	if err := en.ns.SendEmail(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func (en *EmailNotifier) SendResolved() bool {
	return !en.GetDisableResolveMessage()
}

func splitEmails(emails string) []string {
	return strings.FieldsFunc(emails, func(r rune) bool {
		switch r {
		case ',', ';', '\n':
			return true
		}
		return false
	})
}
