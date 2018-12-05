package notifiers

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "hangoutschat",
		Name:        "Google Hangouts Chat",
		Description: "Sends notifications to Google Hangouts Chat via webhook",
		Factory:     NewHangoutsChatNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Google Hangouts Chat settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">URL</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Webhook URL"></input>
      </div>
    `,
	})
}

func NewHangoutsChatNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find URL property in settings"}
	}

	return &HangoutsChatNotifier{
		NotifierBase: NewNotifierBase(model),
		Url:          url,
		log:          log.New("alerting.notifier.hangoutschat"),
	}, nil
}

type HangoutsChatNotifier struct {
	NotifierBase
	Url string
	log log.Logger
}

func (this *HangoutsChatNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing Hangouts Chat notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	wkv := make([]map[string]interface{}, 0)
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		wkv = append(wkv, map[string]interface{}{
			"keyValue": map[string]interface{}{
				"topLabel":         evt.Metric,
				"content":          evt.Value.FullString(),
				"contentMultiline": false,
			},
		})
		if index > fieldLimitCount {
			break
		}
	}

	if evalContext.Error != nil {
		wkv = append(wkv, map[string]interface{}{
			"keyValue": map[string]interface{}{
				"topLabel":         "Error message",
				"content":          evalContext.Error.Error(),
				"contentMultiline": true,
			},
		})
	}

	var wimg []map[string]interface{}
	if evalContext.ImagePublicUrl != "" {
		wimg = append(wimg, map[string]interface{}{
			"image": map[string]interface{}{
				"imageUrl": evalContext.ImagePublicUrl,
				"onClick": map[string]interface{}{
					"openLink": map[string]interface{}{
						"url": ruleUrl,
					},
				},
			},
		})
	}

	var message string
	if evalContext.Rule.State != m.AlertStateOK {
		message = evalContext.Rule.Message
	}

	sections := make([]map[string]interface{}, 0)
	sections = append(sections, map[string]interface{}{
		"widgets": []map[string]interface{}{
			{
				"textParagraph": map[string]interface{}{
					"text": message,
				},
			},
		},
	})

	if len(wkv) > 0 {
		sections = append(sections, map[string]interface{}{
			"widgets": wkv,
		})
	}

	if len(wimg) > 0 {
		sections = append(sections, map[string]interface{}{
			"widgets": wimg,
		})
	}

	sections = append(sections, map[string]interface{}{
		"widgets": []map[string]interface{}{
			{
				"buttons": []map[string]interface{}{
					{
						"textButton": map[string]interface{}{
							"text": "View Details",
							"onClick": map[string]interface{}{
								"openLink": map[string]interface{}{
									"url": ruleUrl,
								},
							},
						},
					},
				},
			},
		},
	})

	body := map[string]interface{}{
		"cards": []map[string]interface{}{
			{
				"header": map[string]interface{}{
					"title":      evalContext.Rule.Name,
					"subtitle":   evalContext.GetStateModel().Text,
					"imageUrl":   "https://grafana.com/assets/img/fav32.png",
					"imageStyle": "image",
				},
				"sections": sections,
			},
		},
	}

	data, err := json.Marshal(&body)
	if err != nil {
		this.log.Error("Failed to encode notification body", "error", err)
		return err
	}

	header := map[string]string{
		"Content-Type": "application/json; charset=UTF-8",
	}

	cmd := &m.SendWebhookSync{Url: this.Url, HttpHeader: header, Body: string(data)}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send Hangouts Chat notification", "error", err)
		return err
	}

	return nil
}
