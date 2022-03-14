package channels

import (
	"context"
	"errors"
	"net/url"
	"path"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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
	log         log.Logger
	ns          notifications.EmailSender
	tmpl        *template.Template
}

type EmailConfig struct {
	*NotificationChannelConfig
	SingleEmail bool
	Addresses   []string
	Message     string
}

func EmailFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewEmailConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewEmailNotifier(cfg, fc.NotificationService, fc.Template), nil
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
		Addresses:                 addresses,
	}, nil
}

// NewEmailNotifier is the constructor function
// for the EmailNotifier.
func NewEmailNotifier(config *EmailConfig, ns notifications.EmailSender, t *template.Template) *EmailNotifier {
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
		log:         log.New("alerting.notifier.email"),
		ns:          ns,
		tmpl:        t,
	}
}

// Notify sends the alert notification.
func (en *EmailNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, data := TmplText(ctx, en.tmpl, as, en.log, &tmplErr)

	title := tmpl(DefaultMessageTitleEmbed)

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
			Subject: title,
			Data: map[string]interface{}{
				"Title":             title,
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
