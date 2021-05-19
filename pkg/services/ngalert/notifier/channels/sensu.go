package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
)

// SensuNotifier is responsible for sending
// alert notification to Sensu.
type SensuNotifier struct {
	old_notifiers.NotifierBase

	url      *url.URL
	message  string
	user     string
	password string
	handler  string
	log      log.Logger
	tmpl     *template.Template
}

// NewSensuNotifier is the constructor for the Sensu notifier
func NewSensuNotifier(model *NotificationChannelConfig, t *template.Template) (*SensuNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No settings supplied"}
	}
	us := model.Settings.Get("url").MustString()
	if us == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}
	u, err := url.Parse(us)
	if err != nil {
		return nil, alerting.ValidationError{Reason: "Invalid url property in settings"}
	}

	return &SensuNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
			SecureSettings:        model.SecureSettings,
		}),
		message:  model.Settings.Get("message").MustString(`{{ template "default.message" . }}`),
		url:      u,
		user:     model.Settings.Get("username").MustString(),
		password: model.DecryptedValue("password", model.Settings.Get("password").MustString()),
		handler:  model.Settings.Get("handler").MustString(),
		log:      log.New("alerting.notifier.sensu"),
		tmpl:     t,
	}, nil
}

// Notify sends an alert notification to Sensu.
func (sn *SensuNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	data := notify.GetTemplateData(ctx, sn.tmpl, as, gokit_log.NewNopLogger())
	alerts := types.Alerts(as...)
	var tmplErr error
	tmpl := notify.TmplText(sn.tmpl, data, &tmplErr)

	var status int
	switch st := alerts.Status(); st {
	case model.AlertFiring:
		status = 2
	case model.AlertResolved:
		status = 0
	default:
		panic(fmt.Sprintf("Unhandled status code: %q\n", st))
	}

	ruleURL := path.Join(sn.tmpl.ExternalURL.String(), "alerting/list")
	msg := sensuMessage{
		// TODO: Should we have something more specific?
		Name: "Grafana",
		// TODO: Should we have something more specific?
		Source:    "Grafana",
		Output:    "Grafana metric condition met",
		Handler:   sn.handler,
		TitleLink: ruleURL,
		RuleURL:   ruleURL,
		Status:    status,
		Message:   tmpl(sn.message),
	}
	if tmplErr != nil {
		return false, fmt.Errorf("failed to template Sensu message: %w", tmplErr)
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return false, fmt.Errorf("failed to encode JSON: %w", err)
	}

	sn.log.Debug("Sending Sensu request", "url", sn.url.String(), "data", string(b))
	if _, err := sendHTTPRequest(ctx, sn.url, httpCfg{user: sn.user, password: sn.password, body: b},
		sn.log); err != nil {
		return false, err
	}

	return true, nil
}

func (sn *SensuNotifier) SendResolved() bool {
	return !sn.GetDisableResolveMessage()
}

type sensuMessage struct {
	Name      string `json:"name"`
	Source    string `json:"name"`
	Output    string `json:"output"`
	Handler   string `json:"handler"`
	TitleLink string `json:"titleLink"`
	RuleURL   string `json:"ruleUrl"`
	Message   string `json:"message"`
	Status    int    `json:"int"`
}
