package channels

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

var (
	LineNotifyURL string = "https://notify-api.line.me/api/notify"
)

type LineConfig struct {
	*NotificationChannelConfig
	Token string
}

func LineFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewLineConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewLineNotifier(cfg, fc.NotificationService, fc.Template), nil
}

func NewLineConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*LineConfig, error) {
	token := decryptFunc(context.Background(), config.SecureSettings, "token", config.Settings.Get("token").MustString())
	if token == "" {
		return nil, errors.New("could not find token in settings")
	}
	return &LineConfig{
		NotificationChannelConfig: config,
		Token:                     token,
	}, nil
}

// NewLineNotifier is the constructor for the LINE notifier
func NewLineNotifier(config *LineConfig, ns notifications.WebhookSender, t *template.Template) *LineNotifier {
	return &LineNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		Token: config.Token,
		log:   log.New("alerting.notifier.line"),
		ns:    ns,
		tmpl:  t,
	}
}

// LineNotifier is responsible for sending
// alert notifications to LINE.
type LineNotifier struct {
	*Base
	Token string
	log   log.Logger
	ns    notifications.WebhookSender
	tmpl  *template.Template
}

// Notify send an alert notification to LINE
func (ln *LineNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	ln.log.Debug("executing line notification", "notification", ln.Name)

	ruleURL := path.Join(ln.tmpl.ExternalURL.String(), "/alerting/list")

	var tmplErr error
	tmpl, _ := TmplText(ctx, ln.tmpl, as, ln.log, &tmplErr)

	body := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(DefaultMessageTitleEmbed),
		ruleURL,
		tmpl(DefaultMessageEmbed),
	)
	if tmplErr != nil {
		ln.log.Warn("failed to template Line message", "err", tmplErr.Error())
	}

	form := url.Values{}
	form.Add("message", body)

	cmd := &models.SendWebhookSync{
		Url:        LineNotifyURL,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.Token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := ln.ns.SendWebhookSync(ctx, cmd); err != nil {
		ln.log.Error("failed to send notification to LINE", "err", err, "body", body)
		return false, err
	}

	return true, nil
}

func (ln *LineNotifier) SendResolved() bool {
	return !ln.GetDisableResolveMessage()
}
