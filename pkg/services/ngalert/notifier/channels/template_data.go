package channels

import (
	"context"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ExtendedAlert struct {
	Status       string      `json:"status"`
	Labels       template.KV `json:"labels"`
	Annotations  template.KV `json:"annotations"`
	StartsAt     time.Time   `json:"startsAt"`
	EndsAt       time.Time   `json:"endsAt"`
	GeneratorURL string      `json:"generatorURL"`
	Fingerprint  string      `json:"fingerprint"`
	SilenceURL   string      `json:"silenceURL"`
	DashboardURL string      `json:"dashboardURL"`
	PanelURL     string      `json:"panelURL"`
	ValueString  string      `json:"valueString"`
	ImageURL     string      `json:"imageURL,omitempty"`
}

type ExtendedAlerts []ExtendedAlert

type ExtendedData struct {
	Receiver string         `json:"receiver"`
	Status   string         `json:"status"`
	Alerts   ExtendedAlerts `json:"alerts"`

	GroupLabels       template.KV `json:"groupLabels"`
	CommonLabels      template.KV `json:"commonLabels"`
	CommonAnnotations template.KV `json:"commonAnnotations"`

	ExternalURL string `json:"externalURL"`
}

func removePrivateItems(kv template.KV) template.KV {
	for key := range kv {
		if strings.HasPrefix(key, "__") && strings.HasSuffix(key, "__") {
			kv = kv.Remove([]string{key})
		}
	}
	return kv
}

func extendAlert(alert template.Alert, externalURL string, logger log.Logger) *ExtendedAlert {
	// remove "private" annotations & labels so they don't show up in the template
	extended := &ExtendedAlert{
		Status:       alert.Status,
		Labels:       removePrivateItems(alert.Labels),
		Annotations:  removePrivateItems(alert.Annotations),
		StartsAt:     alert.StartsAt,
		EndsAt:       alert.EndsAt,
		GeneratorURL: alert.GeneratorURL,
		Fingerprint:  alert.Fingerprint,
	}

	// fill in some grafana-specific urls
	if len(externalURL) == 0 {
		return extended
	}
	u, err := url.Parse(externalURL)
	if err != nil {
		logger.Debug("failed to parse external URL while extending template data", "url", externalURL, "err", err.Error())
		return extended
	}
	externalPath := u.Path
	dashboardUid := alert.Annotations[ngmodels.DashboardUIDAnnotation]
	if len(dashboardUid) > 0 {
		u.Path = path.Join(externalPath, "/d/", dashboardUid)
		extended.DashboardURL = u.String()
		panelId := alert.Annotations[ngmodels.PanelIDAnnotation]
		if len(panelId) > 0 {
			u.RawQuery = "viewPanel=" + panelId
			extended.PanelURL = u.String()
		}
	}

	if alert.Annotations != nil {
		extended.ValueString = alert.Annotations[`__value_string__`]
	}

	matchers := make([]string, 0)
	for key, value := range alert.Labels {
		if !(strings.HasPrefix(key, "__") && strings.HasSuffix(key, "__")) {
			matchers = append(matchers, key+"="+value)
		}
	}
	sort.Strings(matchers)
	u.Path = path.Join(externalPath, "/alerting/silence/new")

	query := make(url.Values)
	query.Add("alertmanager", "grafana")
	for _, matcher := range matchers {
		query.Add("matcher", matcher)
	}

	u.RawQuery = query.Encode()

	extended.SilenceURL = u.String()

	return extended
}

func ExtendData(data *template.Data, logger log.Logger) *ExtendedData {
	alerts := []ExtendedAlert{}

	for _, alert := range data.Alerts {
		extendedAlert := extendAlert(alert, data.ExternalURL, logger)
		alerts = append(alerts, *extendedAlert)
	}

	extended := &ExtendedData{
		Receiver:          data.Receiver,
		Status:            data.Status,
		Alerts:            alerts,
		GroupLabels:       data.GroupLabels,
		CommonLabels:      removePrivateItems(data.CommonLabels),
		CommonAnnotations: removePrivateItems(data.CommonAnnotations),

		ExternalURL: data.ExternalURL,
	}
	return extended
}

func TmplText(ctx context.Context, tmpl *template.Template, alerts []*types.Alert, l log.Logger, tmplErr *error) (func(string) string, *ExtendedData) {
	promTmplData := notify.GetTemplateData(ctx, tmpl, alerts, l)
	data := ExtendData(promTmplData, l)

	return func(name string) (s string) {
		if *tmplErr != nil {
			return
		}
		s, *tmplErr = tmpl.ExecuteTextString(name, data)
		return s
	}, data
}

// Firing returns the subset of alerts that are firing.
func (as ExtendedAlerts) Firing() []ExtendedAlert {
	res := []ExtendedAlert{}
	for _, a := range as {
		if a.Status == string(model.AlertFiring) {
			res = append(res, a)
		}
	}
	return res
}

// Resolved returns the subset of alerts that are resolved.
func (as ExtendedAlerts) Resolved() []ExtendedAlert {
	res := []ExtendedAlert{}
	for _, a := range as {
		if a.Status == string(model.AlertResolved) {
			res = append(res, a)
		}
	}
	return res
}
