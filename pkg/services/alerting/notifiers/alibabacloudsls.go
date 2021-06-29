package notifiers

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "alibaba-cloud-sls",
		Name:        "Alibaba Cloud SLS (Log Service)",
		Description: "Sends notifications to Alibaba Cloud SLS (Log Service)",
		Heading:     "Alibaba Cloud SLS (Log Service) settings",
		Factory:     NewAlibabaCloudSLSNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:   "Default Severity",
				Element: alerting.ElementTypeSelect,
				SelectOptions: []alerting.SelectOption{
					{
						Value: "Critical",
						Label: "Critical",
					},
					{
						Value: "High",
						Label: "High",
					},
					{
						Value: "Medium",
						Label: "Medium",
					},
					{
						Value: "Info",
						Label: "Info",
					},
					{
						Value: "Report",
						Label: "Report",
					},
				},
				PropertyName: "defaultSeverity",
				Required:     true,
			},
		},
	})
}

// NewAlibabaCloudSLSNotifier is the constructor for
// the alibaba-cloud-sls notifier.
func NewAlibabaCloudSLSNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	defaultSeverity := model.Settings.Get("defaultSeverity").MustString()
	if defaultSeverity == "" {
		defaultSeverity = "Medium"
	}

	return &AlibabaCloudSLSNotifier{
		NotifierBase:    NewNotifierBase(model),
		URL:             url,
		DefaultSeverity: defaultSeverity,
		log:             log.New("alerting.notifier.alibaba-cloud-sls"),
	}, nil
}

// AlibabaCloudSLSNotifier is responsible for sending
// alert notifications as alibaba-cloud-sls.
type AlibabaCloudSLSNotifier struct {
	NotifierBase
	URL             string
	DefaultSeverity string
	log             log.Logger
}

// Notify send alert notifications to
// alibaba-cloud-sls.
func (sn *AlibabaCloudSLSNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("sending alert to alibaba-cloud-sls")

	bodyJSON := simplejson.New()

	bodyJSON.Set("title", evalContext.GetNotificationTitle())
	bodyJSON.Set("startTime", evalContext.StartTime.Unix())

	bodyJSON.Set("evalMatches", evalContext.EvalMatches)

	bodyJSON.Set("ruleId", evalContext.Rule.ID)
	bodyJSON.Set("ruleName", evalContext.Rule.Name)
	bodyJSON.Set("state", evalContext.Rule.State)
	bodyJSON.Set("orgId", evalContext.Rule.OrgID)
	bodyJSON.Set("dashboardId", evalContext.Rule.DashboardID)
	bodyJSON.Set("panelId", evalContext.Rule.PanelID)
	bodyJSON.Set("message", evalContext.Rule.Message)

	tags := make(map[string]string)
	tags["severity"] = sn.DefaultSeverity
	for _, tag := range evalContext.Rule.AlertRuleTags {
		tags[tag.Key] = tag.Value
	}
	bodyJSON.Set("tags", tags)

	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleURL)
	}

	if sn.NeedsImage() && evalContext.ImagePublicURL != "" {
		bodyJSON.Set("imageUrl", evalContext.ImagePublicURL)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        sn.URL,
		Body:       string(body),
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		sn.log.Error("Failed to send alert to alibaba-cloud-sls", "error", err)
		return err
	}

	return nil
}
