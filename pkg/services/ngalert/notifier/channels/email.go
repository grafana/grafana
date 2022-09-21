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
	ch, err := buildEmailNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

func buildEmailNotifier(fc FactoryConfig) (*EmailNotifier, error) {
	addressesString := fc.Config.Settings.Get("addresses").MustString()
	if addressesString == "" {
		return nil, errors.New("could not find addresses in settings")
	}
	// split addresses with a few different ways
	addresses := util.SplitEmails(addressesString)

	return &EmailNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		Addresses:   addresses,
		SingleEmail: fc.Config.Settings.Get("singleEmail").MustBool(false),
		Message:     fc.Config.Settings.Get("message").MustString(),
		Subject:     fc.Config.Settings.Get("subject").MustString(DefaultMessageTitleEmbed),
		log:         log.New("alerting.notifier.email"),
		ns:          fc.NotificationService,
		images:      fc.ImageStore,
		tmpl:        fc.Template,
	}, nil
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
		en.log.Debug("failed to parse external URL", "url", en.tmpl.ExternalURL.String(), "err", err.Error())
	}

	// Extend alerts data with images, if available.
	var embeddedFiles []string
	_ = withStoredImages(ctx, en.log, en.images,
		func(index int, image ngmodels.Image) error {
			if len(image.URL) != 0 {
				data.Alerts[index].ImageURL = image.URL
			} else if len(image.Path) != 0 {
				_, err := os.Stat(image.Path)
				if err == nil {
					data.Alerts[index].EmbeddedImage = path.Base(image.Path)
					embeddedFiles = append(embeddedFiles, image.Path)
				} else {
					en.log.Warn("failed to get image file for email attachment", "file", image.Path, "err", err)
				}
			}
			return nil
		}, alerts...)

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
			EmbeddedFiles: embeddedFiles,
			To:            en.Addresses,
			SingleEmail:   en.SingleEmail,
			Template:      "ng_alert_notification",
		},
	}

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
