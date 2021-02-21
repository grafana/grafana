package notifiers

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "sensugo",
		Name:        "Sensu Go",
		Description: "Sends HTTP POST request to a Sensu Go API",
		Heading:     "Sensu Go Settings",
		Factory:     NewSensuGoNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Backend URL",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "http://sensu-api.local:8080",
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:        "API Key",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypePassword,
				Description:  "API Key to auth to Sensu Go backend",
				PropertyName: "apikey",
				Required:     true,
				Secure:       true,
			},
			{
				Label:        "Proxy entity name",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "If empty, rule name will be used",
				PropertyName: "entity",
			},
			{
				Label:        "Check name",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "If empty, rule id will be used",
				PropertyName: "check",
			},
			{
				Label:        "Handler",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "handler",
			},
			{
				Label:        "Namespace",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "default",
				PropertyName: "namespace",
			},
		},
	})
}

// NewSensuGoNotifier is the constructor for the Sensu Go Notifier.
func NewSensuGoNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	apikey := model.DecryptedValue("apikey", model.Settings.Get("apikey").MustString())

	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find URL property in settings"}
	}
	if apikey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find the API Key property in settings"}
	}

	return &SensuGoNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          url,
		Entity:       model.Settings.Get("entity").MustString(),
		Check:        model.Settings.Get("check").MustString(),
		Namespace:    model.Settings.Get("namespace").MustString(),
		Handler:      model.Settings.Get("handler").MustString(),
		APIKey:       apikey,
		log:          log.New("alerting.notifier.sensugo"),
	}, nil
}

// SensuGoNotifier is responsible for sending
// alert notifications to Sensu Go.
type SensuGoNotifier struct {
	NotifierBase
	URL       string
	Entity    string
	Check     string
	Namespace string
	Handler   string
	APIKey    string
	log       log.Logger
}

// Notify send alert notification to Sensu Go
func (sn *SensuGoNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("Sending Sensu Go result")

	var namespace string

	bodyJSON := simplejson.New()
	// Sensu Go alerts require an entity and a check. We set it to the user-specified
	// value (optional), else we fallback and use the grafana rule anme  and ruleID.
	if sn.Entity != "" {
		bodyJSON.SetPath([]string{"entity", "metadata", "name"}, sn.Entity)
	} else {
		// Sensu Go alerts cannot have spaces in them
		bodyJSON.SetPath([]string{"entity", "metadata", "name"}, strings.ReplaceAll(evalContext.Rule.Name, " ", "_"))
	}
	if sn.Check != "" {
		bodyJSON.SetPath([]string{"check", "metadata", "name"}, sn.Check)
	} else {
		bodyJSON.SetPath([]string{"check", "metadata", "name"}, "grafana_rule_"+strconv.FormatInt(evalContext.Rule.ID, 10))
	}
	// Sensu Go requires the entity in an event specify its namespace.  We set it to
	// the user-specified value (optional), else we fallback and use default
	if sn.Namespace != "" {
		bodyJSON.SetPath([]string{"entity", "metadata", "namespace"}, sn.Namespace)
		namespace = sn.Namespace
	} else {
		bodyJSON.SetPath([]string{"entity", "metadata", "namespace"}, "default")
		namespace = "default"
	}
	// Sensu Go needs check output
	if evalContext.Rule.Message != "" {
		bodyJSON.SetPath([]string{"check", "output"}, evalContext.Rule.Message)
	} else {
		bodyJSON.SetPath([]string{"check", "output"}, "Grafana Metric Condition Met")
	}
	// Sensu GO requires that the check portion of the event have an interval
	bodyJSON.SetPath([]string{"check", "interval"}, 86400)

	switch evalContext.Rule.State {
	case "alerting":
		bodyJSON.SetPath([]string{"check", "status"}, 2)
	case "no_data":
		bodyJSON.SetPath([]string{"check", "status"}, 1)
	default:
		bodyJSON.SetPath([]string{"check", "status"}, 0)
	}

	if sn.Handler != "" {
		bodyJSON.SetPath([]string{"check", "handlers"}, []string{sn.Handler})
	}

	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleURL)
	}

	labels := map[string]string{
		"ruleName": evalContext.Rule.Name,
		"ruleId":   strconv.FormatInt(evalContext.Rule.ID, 10),
		"ruleURL":  ruleURL,
	}

	if sn.NeedsImage() && evalContext.ImagePublicURL != "" {
		labels["imageUrl"] = evalContext.ImagePublicURL
	}

	bodyJSON.SetPath([]string{"check", "metadata", "labels"}, labels)

	body, err := bodyJSON.MarshalJSON()
	if err != nil {
		return err
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
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		sn.log.Error("Failed to send Sensu Go event", "error", err, "sensugo", sn.Name)
		return err
	}

	return nil
}
