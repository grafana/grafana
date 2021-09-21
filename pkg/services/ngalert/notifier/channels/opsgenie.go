package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
)

const (
	OpsgenieSendTags    = "tags"
	OpsgenieSendDetails = "details"
	OpsgenieSendBoth    = "both"
)

var (
	OpsgenieAlertURL = "https://api.opsgenie.com/v2/alerts"
	ValidPriorities  = map[string]bool{"P1": true, "P2": true, "P3": true, "P4": true, "P5": true}
)

// OpsgenieNotifier is responsible for sending alert notifications to Opsgenie.
type OpsgenieNotifier struct {
	old_notifiers.NotifierBase
	APIKey           string
	APIUrl           string
	AutoClose        bool
	OverridePriority bool
	SendTagsAs       string
	tmpl             *template.Template
	log              log.Logger
}

// NewOpsgenieNotifier is the constructor for the Opsgenie notifier
func NewOpsgenieNotifier(model *NotificationChannelConfig, t *template.Template) (*OpsgenieNotifier, error) {
	autoClose := model.Settings.Get("autoClose").MustBool(true)
	overridePriority := model.Settings.Get("overridePriority").MustBool(true)
	apiKey := model.DecryptedValue("apiKey", model.Settings.Get("apiKey").MustString())
	apiURL := model.Settings.Get("apiUrl").MustString()
	if apiKey == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find api key property in settings"}
	}
	if apiURL == "" {
		apiURL = OpsgenieAlertURL
	}

	sendTagsAs := model.Settings.Get("sendTagsAs").MustString(OpsgenieSendTags)
	if sendTagsAs != OpsgenieSendTags && sendTagsAs != OpsgenieSendDetails && sendTagsAs != OpsgenieSendBoth {
		return nil, receiverInitError{Cfg: *model,
			Reason: fmt.Sprintf("invalid value for sendTagsAs: %q", sendTagsAs),
		}
	}

	return &OpsgenieNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		APIKey:           apiKey,
		APIUrl:           apiURL,
		AutoClose:        autoClose,
		OverridePriority: overridePriority,
		SendTagsAs:       sendTagsAs,
		tmpl:             t,
		log:              log.New("alerting.notifier." + model.Name),
	}, nil
}

// Notify sends an alert notification to Opsgenie
func (on *OpsgenieNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	on.log.Debug("Executing Opsgenie notification", "notification", on.Name)

	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved && !on.SendResolved() {
		on.log.Debug("Not sending a trigger to Opsgenie", "status", alerts.Status(), "auto resolve", on.SendResolved())
		return true, nil
	}

	bodyJSON, url, err := on.buildOpsgenieMessage(ctx, alerts, as)
	if err != nil {
		return false, fmt.Errorf("build Opsgenie message: %w", err)
	}

	if url == "" {
		// Resolved alert with no auto close.
		// Hence skip sending anything.
		return true, nil
	}

	body, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, fmt.Errorf("marshal json: %w", err)
	}

	cmd := &models.SendWebhookSync{
		Url:        url,
		Body:       string(body),
		HttpMethod: http.MethodPost,
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.APIKey),
		},
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		return false, fmt.Errorf("send notification to Opsgenie: %w", err)
	}

	return true, nil
}

func (on *OpsgenieNotifier) buildOpsgenieMessage(ctx context.Context, alerts model.Alerts, as []*types.Alert) (payload *simplejson.Json, apiURL string, err error) {
	key, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return nil, "", err
	}

	var (
		alias    = key.Hash()
		bodyJSON = simplejson.New()
		details  = simplejson.New()
	)

	if alerts.Status() == model.AlertResolved {
		// For resolved notification, we only need the source.
		// Don't need to run other templates.
		if on.AutoClose {
			bodyJSON := simplejson.New()
			bodyJSON.Set("source", "Grafana")
			apiURL = fmt.Sprintf("%s/%s/close?identifierType=alias", on.APIUrl, alias)
			return bodyJSON, apiURL, nil
		}
		return nil, "", nil
	}

	ruleURL := joinUrlPath(on.tmpl.ExternalURL.String(), "/alerting/list", on.log)

	var tmplErr error
	tmpl, data := TmplText(ctx, on.tmpl, as, on.log, &tmplErr)

	title := tmpl(`{{ template "default.title" . }}`)
	description := fmt.Sprintf(
		"%s\n%s\n\n%s",
		tmpl(`{{ template "default.title" . }}`),
		ruleURL,
		tmpl(`{{ template "default.message" . }}`),
	)

	var priority string

	// In the new alerting system we've moved away from the grafana-tags. Instead, annotations on the rule itself should be used.
	lbls := make(map[string]string, len(data.CommonLabels))
	for k, v := range data.CommonLabels {
		lbls[k] = tmpl(v)

		if k == "og_priority" {
			if ValidPriorities[v] {
				priority = v
			}
		}
	}

	bodyJSON.Set("message", title)
	bodyJSON.Set("source", "Grafana")
	bodyJSON.Set("alias", alias)
	bodyJSON.Set("description", description)
	details.Set("url", ruleURL)

	if on.sendDetails() {
		for k, v := range lbls {
			details.Set(k, v)
		}
	}

	tags := make([]string, 0, len(lbls))
	if on.sendTags() {
		for k, v := range lbls {
			tags = append(tags, fmt.Sprintf("%s:%s", k, v))
		}
	}
	sort.Strings(tags)

	if priority != "" && on.OverridePriority {
		bodyJSON.Set("priority", priority)
	}

	bodyJSON.Set("tags", tags)
	bodyJSON.Set("details", details)
	apiURL = tmpl(on.APIUrl)

	if tmplErr != nil {
		on.log.Debug("failed to template Opsgenie message", "err", tmplErr.Error())
	}

	return bodyJSON, apiURL, nil
}

func (on *OpsgenieNotifier) SendResolved() bool {
	return !on.GetDisableResolveMessage()
}

func (on *OpsgenieNotifier) sendDetails() bool {
	return on.SendTagsAs == OpsgenieSendDetails || on.SendTagsAs == OpsgenieSendBoth
}

func (on *OpsgenieNotifier) sendTags() bool {
	return on.SendTagsAs == OpsgenieSendTags || on.SendTagsAs == OpsgenieSendBoth
}
