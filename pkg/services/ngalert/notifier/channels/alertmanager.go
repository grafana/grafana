package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"strings"

	gokit_log "github.com/go-kit/kit/log"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/services/ngalert/logging"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// NewAlertmanagerNotifier returns a new Alertmanager notifier.
func NewAlertmanagerNotifier(model *NotificationChannelConfig, t *template.Template) (*AlertmanagerNotifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No settings supplied"}
	}

	urlStr := model.Settings.Get("url").MustString()
	if urlStr == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	var urls []*url.URL
	for _, uS := range strings.Split(urlStr, ",") {
		uS = strings.TrimSpace(uS)
		if uS == "" {
			continue
		}

		uS = strings.TrimSuffix(uS, "/") + "/api/v1/alerts"
		u, err := url.Parse(uS)
		if err != nil {
			return nil, fmt.Errorf("failed to parse URL %q: %w", uS, err)
		}

		urls = append(urls, u)
	}
	basicAuthUser := model.Settings.Get("basicAuthUser").MustString()
	basicAuthPassword := model.DecryptedValue("basicAuthPassword", model.Settings.Get("basicAuthPassword").MustString())

	return &AlertmanagerNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		urls:              urls,
		basicAuthUser:     basicAuthUser,
		basicAuthPassword: basicAuthPassword,
		message:           model.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
		logger:            log.New("alerting.notifier.prometheus-alertmanager"),
		tmpl:              t,
	}, nil
}

// AlertmanagerNotifier sends alert notifications to the alert manager
type AlertmanagerNotifier struct {
	old_notifiers.NotifierBase

	urls              []*url.URL
	basicAuthUser     string
	basicAuthPassword string
	message           string
	logger            log.Logger
	tmpl              *template.Template
}

type alertmanagerAnnotations struct {
	Summary     string   `json:"summary"`
	Description string   `json:"description"`
	Image       *url.URL `json:"image"`
}

type alertmanagerMessage struct {
	StartsAt     string                  `json:"startsAt"`
	EndsAt       string                  `json:"endsAt"`
	GeneratorURL *url.URL                `json:"generatorUrl"`
	Annotations  alertmanagerAnnotations `json:"annotations"`
	Labels       map[string]string       `json:"labels"`
}

func (n *AlertmanagerNotifier) createAlert(al *types.Alert, message string, ruleURL *url.URL) alertmanagerMessage {
	description := message

	/*
			alertJSON := simplejson.New()
			alertJSON.Set("startsAt", evalContext.StartTime.UTC().Format(time.RFC3339))
			if evalContext.Rule.State == models.AlertStateOK {
				alertJSON.Set("endsAt", time.Now().UTC().Format(time.RFC3339))
			}
			alertJSON.Set("generatorURL", ruleURL)

			// Annotations (summary and description are very commonly used).
			alertJSON.SetPath([]string{"annotations", "summary"}, evalContext.Rule.Name)
			description := ""
			if evalContext.Rule.Message != "" {
				description += evalContext.Rule.Message
			}
			if evalContext.Error != nil {
				if description != "" {
					description += "\n"
				}
				description += "Error: " + evalContext.Error.Error()
			}
			if description != "" {
				alertJSON.SetPath([]string{"annotations", "description"}, description)
			}
			if evalContext.ImagePublicURL != "" {
				alertJSON.SetPath([]string{"annotations", "image"}, evalContext.ImagePublicURL)
			}

		// Labels (from metrics tags + AlertRuleTags + mandatory alertname).
		tags := make(map[string]string)
		if match != nil {
			if len(match.Tags) == 0 {
				tags["metric"] = match.Metric
			} else {
				for k, v := range match.Tags {
					tags[replaceIllegalCharsInLabelname(k)] = v
				}
			}
		}
		for _, tag := range evalContext.Rule.AlertRuleTags {
			tags[tag.Key] = tag.Value
		}
		tags["alertname"] = evalContext.Rule.Name
		alertJSON.Set("labels", tags)
	*/
	return alertmanagerMessage{
		GeneratorURL: ruleURL,
		Annotations: alertmanagerAnnotations{
			Description: description,
		},
	}
}

// Notify sends alert notifications to Alertmanager.
func (n *AlertmanagerNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	n.logger.Info("Sending Alertmanager alert", "alertmanager", n.Name)

	ruleURL, err := url.Parse(n.tmpl.ExternalURL.String())
	if err != nil {
		return false, fmt.Errorf("failed to parse external URL %q: %w", n.tmpl.ExternalURL.String(), err)
	}

	ruleURL.Path = path.Join(ruleURL.Path, "/alerting/list")

	data := notify.GetTemplateData(ctx, n.tmpl, as, gokit_log.NewLogfmtLogger(logging.NewWrapper(n.logger)))
	var tmplErr error
	tmpl := notify.TmplText(n.tmpl, data, &tmplErr)

	message := tmpl(n.message)

	if tmplErr != nil {
		return false, fmt.Errorf("templating failed: %w", tmplErr)
	}

	// Send one alert per matching series
	alerts := make([]alertmanagerMessage, 0, len(as))
	for _, al := range as {
		alert := n.createAlert(al, message, ruleURL)
		alerts = append(alerts, alert)
	}

	// This happens on ExecutionError or NoData
	if len(alerts) == 0 {
		alert := n.createAlert(nil, message, ruleURL)
		alerts = append(alerts, alert)
	}

	body, err := json.Marshal(alerts)
	if err != nil {
		return false, err
	}

	errCnt := 0
	for _, u := range n.urls {
		if _, err := sendHTTPRequest(ctx, u, httpCfg{
			user:     n.basicAuthUser,
			password: n.basicAuthPassword,
			body:     body,
		}, n.logger); err != nil {
			n.logger.Warn("Failed to send to Alertmanager", "error", err, "alertmanager", n.Name, "url", u.String())
			errCnt++
		}
	}

	// This happens when every dispatch fails
	if errCnt == len(n.urls) {
		n.logger.Warn("All attempts to send to Alertmanager failed", "alertmanager", n.Name)
		return false, fmt.Errorf("failed to send alert to Alertmanager")
	}

	return true, nil
}

/*
// regexp that matches all invalid label name characters
// https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
var reAlertManagerLabel = regexp.MustCompile(`[^a-zA-Z0-9_]`)

func replaceIllegalCharsInLabelname(input string) string {
	return reAlertManagerLabel.ReplaceAllString(input, "_")
}
*/
