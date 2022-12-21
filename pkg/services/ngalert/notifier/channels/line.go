package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/alerting/alerting/notifier/channels"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

var (
	LineNotifyURL string = "https://notify-api.line.me/api/notify"
)

// LineNotifier is responsible for sending
// alert notifications to LINE.
type LineNotifier struct {
	*channels.Base
	log      channels.Logger
	ns       channels.WebhookSender
	tmpl     *template.Template
	settings *lineSettings
}

type lineSettings struct {
	Token       string `json:"token,omitempty" yaml:"token,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func buildLineSettings(fc channels.FactoryConfig) (*lineSettings, error) {
	var settings lineSettings
	err := json.Unmarshal(fc.Config.Settings, &settings)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.Token = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "token", settings.Token)
	if settings.Token == "" {
		return nil, errors.New("could not find token in settings")
	}
	if settings.Title == "" {
		settings.Title = channels.DefaultMessageTitleEmbed
	}
	if settings.Description == "" {
		settings.Description = channels.DefaultMessageEmbed
	}
	return &settings, nil
}

func LineFactory(fc channels.FactoryConfig) (channels.NotificationChannel, error) {
	n, err := newLineNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return n, nil
}

// newLineNotifier is the constructor for the LINE notifier
func newLineNotifier(fc channels.FactoryConfig) (*LineNotifier, error) {
	settings, err := buildLineSettings(fc)
	if err != nil {
		return nil, err
	}

	return &LineNotifier{
		Base:     channels.NewBase(fc.Config),
		log:      fc.Logger,
		ns:       fc.NotificationService,
		tmpl:     fc.Template,
		settings: settings,
	}, nil
}

// Notify send an alert notification to LINE
func (ln *LineNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	ln.log.Debug("executing line notification", "notification", ln.Name)

	body := ln.buildMessage(ctx, as...)

	form := url.Values{}
	form.Add("message", body)

	cmd := &channels.SendWebhookSettings{
		URL:        LineNotifyURL,
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", ln.settings.Token),
			"Content-Type":  "application/x-www-form-urlencoded;charset=UTF-8",
		},
		Body: form.Encode(),
	}

	if err := ln.ns.SendWebhook(ctx, cmd); err != nil {
		ln.log.Error("failed to send notification to LINE", "error", err, "body", body)
		return false, err
	}

	return true, nil
}

func (ln *LineNotifier) SendResolved() bool {
	return !ln.GetDisableResolveMessage()
}

func (ln *LineNotifier) buildMessage(ctx context.Context, as ...*types.Alert) string {
	ruleURL := path.Join(ln.tmpl.ExternalURL.String(), "/alerting/list")

	var tmplErr error
	tmpl, _ := channels.TmplText(ctx, ln.tmpl, as, ln.log, &tmplErr)

	body := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(ln.settings.Title),
		ruleURL,
		tmpl(ln.settings.Description),
	)
	if tmplErr != nil {
		ln.log.Warn("failed to template Line message", "error", tmplErr.Error())
	}
	return body
}
