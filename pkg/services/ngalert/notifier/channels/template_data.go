package channels

import (
	"context"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

//Number of minutes to be shown on panel that contains an alert before the time an alert is triggered.
//For example, if alert goes to Alerting at 13:00, timeframe starts at 12:55
const alertPanelWindowBeforeTriggerInMinutes = 5 //LOGZ.IO GRAFANA CHANGE :: DEV-32382

const LogzioSwitchToAccountQueryParamName = "switchToAccountId"

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
	//LOGZ.IO GRAFANA CHANGE :: DEV-37746: Add switch to account query param
	accountId := alert.Annotations[ngmodels.LogzioAccountIdAnnotation]
	var generatorUrl string
	parsedGeneratorUrl, err := ParseLogzioAppPath(alert.GeneratorURL)
	if err == nil {
		parsedGeneratorUrl = AppendSwitchToAccountQueryParam(parsedGeneratorUrl, accountId)
		generatorUrl = ToLogzioAppPath(parsedGeneratorUrl.String())
	} else {
		generatorUrl = alert.GeneratorURL
	}
	//LOGZ.IO GRAFANA CHANGE :: end
	// remove "private" annotations & labels so they don't show up in the template
	extended := &ExtendedAlert{
		Status:       alert.Status,
		Labels:       removePrivateItems(alert.Labels),
		Annotations:  removePrivateItems(alert.Annotations),
		StartsAt:     alert.StartsAt,
		EndsAt:       alert.EndsAt,
		GeneratorURL: generatorUrl, //LOGZ.IO GRAFANA CHANGE :: DEV-37746: Add switch to account query param
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
		u.RawQuery = appendAlertPanelTimeframeToQueryString(u.RawQuery, alert)                          //LOGZ.IO GRAFANA CHANGE :: DEV-32382 - Append timeframe for panel/dashboard URL
		extended.DashboardURL = ToLogzioAppPath(AppendSwitchToAccountQueryParam(u, accountId).String()) //LOGZ.IO GRAFANA CHANGE :: DEV-31356: Change grafana default username, footer URL,text to logzio ones, DEV-37746: Add switch to account query param
		panelId := alert.Annotations[ngmodels.PanelIDAnnotation]
		if len(panelId) > 0 {
			u.RawQuery = "viewPanel=" + panelId
			u.RawQuery = appendAlertPanelTimeframeToQueryString(u.RawQuery, alert)                      //LOGZ.IO GRAFANA CHANGE :: DEV-32382 - Append timeframe for panel/dashboard URL
			extended.PanelURL = ToLogzioAppPath(AppendSwitchToAccountQueryParam(u, accountId).String()) //LOGZ.IO GRAFANA CHANGE :: DEV-31356: Change grafana default username, footer URL,text to logzio ones, DEV-37746: Add switch to account query param
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
	u = AppendSwitchToAccountQueryParam(u, accountId) //LOGZ.IO GRAFANA CHANGE :: DEV-37746: Add switch to account query param
	u.RawQuery = ReplaceEncodedSpace(u.RawQuery)      //LOGZ.IO GRAFANA CHANGE :: Replace space encoded as + in silence URL
	extended.SilenceURL = ToLogzioAppPath(u.String()) //LOGZ.IO GRAFANA CHANGE :: DEV-31356: Change grafana default username, footer URL,text to logzio ones

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

		ExternalURL: ToLogzioAppPath(data.ExternalURL), //LOGZ.IO GRAFANA CHANGE :: DEV-31356: Change grafana default username, footer URL,text to logzio ones
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

//LOGZ.IO GRAFANA CHANGE :: DEV-32382 - Append timeframe for panel/dashboard URL
func appendAlertPanelTimeframeToQueryString(queryString string, alert template.Alert) string {
	builder := strings.Builder{}

	builder.WriteString(queryString)
	if len(queryString) > 0 {
		builder.WriteString("&")
	}

	startTime := alert.StartsAt.UnixMilli() - time.Minute.Milliseconds()*alertPanelWindowBeforeTriggerInMinutes
	builder.WriteString("from=")
	builder.WriteString(strconv.FormatInt(startTime, 10))

	var endTime int64
	// If alert is not yet resolved - end time will be set to past date
	if alert.EndsAt.After(alert.StartsAt) {
		endTime = alert.EndsAt.UnixMilli()
	} else {
		endTime = alert.StartsAt.UnixMilli()
	}

	builder.WriteString("&")
	builder.WriteString("to=")
	builder.WriteString(strconv.FormatInt(endTime, 10))

	return builder.String()
}

//LOGZ.IO GRAFANA CHANGE :: end
