package channels

import (
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/common/model"
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

func extendAlert(alert template.Alert, externalURL string) ExtendedAlert {
	extended := ExtendedAlert{
		Status:       alert.Status,
		Labels:       alert.Labels,
		Annotations:  alert.Annotations,
		StartsAt:     alert.StartsAt,
		EndsAt:       alert.EndsAt,
		GeneratorURL: alert.GeneratorURL,
		Fingerprint:  alert.Fingerprint,
	}

	// fill in some grafana-specific urls
	if len(externalURL) > 0 {
		dashboardUid := alert.Annotations["__dashboardUid__"]
		if len(dashboardUid) > 0 {
			extended.DashboardURL = path.Join(externalURL, "/d/", dashboardUid)
		}
		panelId := alert.Annotations["__panelId__"]
		if len(panelId) > 0 {
			extended.PanelURL = path.Join(externalURL, "/d/", dashboardUid) + "?viewPanel=" + panelId
		}

		matchers := make([]string, len(alert.Labels))
		for key, value := range alert.Labels {
			matchers = append(matchers, key+"="+value)
		}
		extended.SilenceURL = path.Join(externalURL, "/alerting/silence/new?alertmanager=grafana&matchers="+url.QueryEscape(strings.Join(matchers, ",")))

	}

	// remove "private" annotations so they don't show up in the template
	for _, key := range alert.Annotations {
		if strings.HasPrefix(key, "__") && strings.HasSuffix(key, "__") {
			extended.Annotations = extended.Annotations.Remove([]string{key})
		}
	}

	return extended
}

func ExtendData(data *template.Data) *ExtendedData {
	alerts := []ExtendedAlert{}

	for _, alert := range data.Alerts {
		alerts = append(alerts, extendAlert(alert, data.ExternalURL))
	}

	extended := &ExtendedData{
		Receiver:          data.Receiver,
		Status:            data.Status,
		Alerts:            alerts,
		GroupLabels:       data.GroupLabels,
		CommonLabels:      data.CommonLabels,
		CommonAnnotations: data.CommonAnnotations,

		ExternalURL: data.ExternalURL,
	}
	return extended
}

func TmplText(tmpl *template.Template, data *ExtendedData, err *error) func(string) string {
	return func(name string) (s string) {
		if *err != nil {
			return
		}
		s, *err = tmpl.ExecuteTextString(name, data)
		return s
	}
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
