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
		Type:        "webexteams",
		Name:        "Webex Teams",
		Description: "Sends notifications to Webex Teams via Webhooks",
		Factory:     NewWebexTeamsNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Webex Teams settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Space ID</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.space_id"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Set the Space ID
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Bot Token</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.token"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Provide a bot token to use the Webex Teams notifier 
        </info-popover>
      </div>
    `,
	})
}

var (
	webexTeamsMessageAPIURL = "https://api.ciscospark.com/v1/messages"
)

// NewWebexTeamsNotifier is the constructor for the Webex Teams notifier
func NewWebexTeamsNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	recipient := model.Settings.Get("space_id").MustString()
	token := model.Settings.Get("token").MustString()
	if token == "" {
		return nil, alerting.ValidationError{Reason: "Could not find token property in settings"}
	}
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	return &WebexTeamsNotifier{
		NotifierBase: NewNotifierBase(model),
		Recipient:    recipient,
		Token:        token,
		Upload:       uploadImage,
		log:          log.New("alerting.notifier.webexteams"),
	}, nil
}

// WebexTeamsNotifier is responsible for sending
// alert notification to Webex Teams.
type WebexTeamsNotifier struct {
	NotifierBase
	Recipient string
	Token     string
	Upload    bool
	log       log.Logger
}

// Notify send alert notification to Teams.
func (wn *WebexTeamsNotifier) Notify(evalContext *alerting.EvalContext) error {
	wn.log.Info("Executing WebexTeams notification", "ruleId", evalContext.Rule.ID, "notification", wn.Name)

	payloadJSON := simplejson.New()
	payloadJSON.Set("text", evalContext.Rule.Name+" - "+evalContext.Rule.Message)
	payloadJSON.Set("roomId", wn.Recipient)

	if evalContext.ImagePublicURL != "" {
		payloadJSON.Set("files", evalContext.ImagePublicURL)
	}
	body, _ := payloadJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        webexTeamsMessageAPIURL,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": "Bearer " + wn.Token,
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		wn.log.Error("Failed to send notification to Webex Teams", "error", err, "body", string(body))
		return err
	}

	return nil
}
