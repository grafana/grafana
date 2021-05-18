package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

type SensuGoNotifier struct {
	old_notifiers.NotifierBase
	log  log.Logger
	tmpl *template.Template

	URL       string
	Entity    string
	Check     string
	Namespace string
	Handler   string
	APIKey    string
	Message   string
}

// NewSensuGoNotifier is the constructor for the SensuGo notifier
func NewSensuGoNotifier(model *NotificationChannelConfig, t *template.Template) (*SensuGoNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No settings supplied"}
	}

	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find URL property in settings"}
	}

	apikey := model.DecryptedValue("apikey", model.Settings.Get("apikey").MustString())
	if apikey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find the API key property in settings"}
	}

	return &SensuGoNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
			SecureSettings:        model.SecureSettings,
		}),
		URL:       url,
		Entity:    model.Settings.Get("entity").MustString(),
		Check:     model.Settings.Get("check").MustString(),
		Namespace: model.Settings.Get("namespace").MustString(),
		Handler:   model.Settings.Get("handler").MustString(),
		APIKey:    apikey,
		Message:   model.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
		log:       log.New("alerting.notifier.sensugo"),
		tmpl:      t,
	}, nil
}

// Notify sends an alert notification to Sensu Go
func (sn *SensuGoNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	sn.log.Debug("Sending Sensu Go result")

	data := notify.GetTemplateData(ctx, sn.tmpl, as, gokit_log.NewNopLogger())
	var tmplErr error
	tmpl := notify.TmplText(sn.tmpl, data, &tmplErr)

	// Sensu Go alerts require an entity and a check. We set it to the user-specified
	// value (optional), else we fallback and use the grafana rule anme  and ruleID.
	entity := sn.Entity
	if entity == "" {
		entity = "default"
	}

	check := sn.Check
	if check == "" {
		check = "default"
	}

	alerts := types.Alerts(as...)
	status := 0
	if alerts.Status() == model.AlertFiring {
		// TODO figure out about NoData old state (we used to send status 1 in that case)
		status = 2
	}

	namespace := sn.Namespace
	if namespace == "" {
		namespace = "default"
	}

	var handlers []string
	if sn.Handler != "" {
		handlers = []string{sn.Handler}
	}

	u, err := url.Parse(sn.tmpl.ExternalURL.String())
	if err != nil {
		return false, fmt.Errorf("failed to parse external URL: %w", err)
	}
	u.Path = path.Join(u.Path, "/alerting/list")
	ruleURL := u.String()
	bodyMsgType := map[string]interface{}{
		"entity": map[string]interface{}{
			"metadata": map[string]interface{}{
				"name":      entity,
				"namespace": namespace,
			},
		},
		"check": map[string]interface{}{
			"metadata": map[string]interface{}{
				"name": check,
				"labels": map[string]string{
					"ruleURL": ruleURL,
				},
			},
			"output":   tmpl(sn.Message),
			"issued":   time.Now().Unix(),
			"interval": 86400,
			"status":   status,
			"handlers": handlers,
		},
		"ruleUrl": ruleURL,
	}

	if tmplErr != nil {
		return false, fmt.Errorf("failed to template sensugo message: %w", tmplErr)
	}

	body, err := json.Marshal(bodyMsgType)
	if err != nil {
		return false, err
	}

	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf("%s/api/core/v2/namespaces/%s/events", strings.TrimSuffix(sn.URL, "/"), namespace),
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("Key %s", sn.APIKey),
		},
	}
	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		sn.log.Error("Failed to send Sensu Go event", "error", err, "sensugo", sn.Name)
		return false, err
	}

	return true, nil
}

func (sn *SensuGoNotifier) SendResolved() bool {
	return !sn.GetDisableResolveMessage()
}
