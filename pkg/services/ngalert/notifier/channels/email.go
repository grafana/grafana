package channels

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
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
	ns          notifications.EmailSender
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
func NewEmailNotifier(config *EmailConfig, ns notifications.EmailSender, images ImageStore, t *template.Template) *EmailNotifier {
	return &EmailNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
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
func (en *EmailNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, data := TmplText(ctx, en.tmpl, as, en.log, &tmplErr)

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
		en.log.Debug("failed to parse external URL", "url", en.tmpl.ExternalURL.String(), "err", err.Error())
	}

	cmd := &models.SendEmailCommandSync{
		SendEmailCommand: models.SendEmailCommand{
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
			To:          en.Addresses,
			SingleEmail: en.SingleEmail,
			Template:    "ng_alert_notification",
		},
	}

	// TODO: modify the email sender code to support multiple file or image URL
	// fields. We cannot use images from every alert yet.
	_ = withStoredImage(ctx, en.log, en.images,
		func(index int, image *ngmodels.Image) error {
			if image == nil {
				return nil
			}

			if len(image.URL) != 0 {
				cmd.Data["ImageLink"] = image.URL
			} else if len(image.Path) != 0 {
				file, err := os.Stat(image.Path)
				if err == nil {
					cmd.EmbeddedFiles = []string{image.Path}
					cmd.Data["EmbeddedImage"] = file.Name()
				} else {
					en.log.Warn("failed to access email notification image attachment data", "err", err)
				}
			}
			return nil
		}, 0, as...)

	if tmplErr != nil {
		en.log.Warn("failed to template email message", "err", tmplErr.Error())
	}

	if err := en.ns.SendEmailCommandHandlerSync(ctx, cmd); err != nil {
		return false, err
	}

	return true, nil
}

func (en *EmailNotifier) SendResolved() bool {
	return !en.GetDisableResolveMessage()
}
