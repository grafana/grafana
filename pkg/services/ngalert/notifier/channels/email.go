package channels

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path"
	"path/filepath"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

// EmailNotifier is responsible for sending
// alert notifications over email.
type EmailNotifier struct {
	*Base
	Addresses   []string
	SingleEmail bool
	Message     string
	Subject     string
	log         log.Logger
	ns          EmailSender
	images      ImageStore
	tmpl        *template.Template
}

type EmailConfig struct {
	*NotificationChannelConfig
	SingleEmail bool
	Addresses   []string
	Message     string
	Subject     string
}

func EmailFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewEmailConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewEmailNotifier(cfg, fc.NotificationService, fc.ImageStore, fc.Template), nil
}

func NewEmailConfig(config *NotificationChannelConfig) (*EmailConfig, error) {
	addressesString := config.Settings.Get("addresses").MustString()
	if addressesString == "" {
		return nil, errors.New("could not find addresses in settings")
	}
	// split addresses with a few different ways
	addresses := util.SplitEmails(addressesString)
	return &EmailConfig{
		NotificationChannelConfig: config,
		SingleEmail:               config.Settings.Get("singleEmail").MustBool(false),
		Message:                   config.Settings.Get("message").MustString(),
		Subject:                   config.Settings.Get("subject").MustString(DefaultMessageTitleEmbed),
		Addresses:                 addresses,
	}, nil
}

// NewEmailNotifier is the constructor function
// for the EmailNotifier.
func NewEmailNotifier(config *EmailConfig, ns EmailSender, images ImageStore, t *template.Template) *EmailNotifier {
	return &EmailNotifier{
		Base:        NewBase(config.UID, config.Name, config.Type, config.DisableResolveMessage),
		Addresses:   config.Addresses,
		SingleEmail: config.SingleEmail,
		Message:     config.Message,
		Subject:     config.Subject,
		log:         log.New("alerting.notifier.email"),
		ns:          ns,
		images:      images,
		tmpl:        t,
	}
}

// Notify sends the alert notification.
func (en *EmailNotifier) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, data := TmplText(ctx, en.tmpl, alerts, en.log, &tmplErr)

	subject := tmpl(en.Subject)
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
		func(index int, image Image) error {
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

	cmd := &SendEmailSettings{
		Subject: subject,
		Data: map[string]interface{}{
			"Title":             subject,
			"Message":           tmpl(en.Message),
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
		To:            en.Addresses,
		SingleEmail:   en.SingleEmail,
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
