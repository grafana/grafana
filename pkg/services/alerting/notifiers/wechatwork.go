package notifiers

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
	"time"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wechatwork",
		Name:        "Wechat Work",
		Description: "Sends HTTP POST request to Wechat Work",
		Factory:     newWechatWorkNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Wechat settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
        <input type="text" required class="gf-form-input max-width-70" ng-model="ctrl.model.settings.url" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxxx"></input>
      </div>
`,
	})
}

func newWechatWorkNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &WechatWorkNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          url,
		log:          log.New("alerting.notifier.wechatwork"),
	}, nil
}

// WechatWorkNotifier is responsible for sending alert notifications to wechat work.
type WechatWorkNotifier struct {
	NotifierBase
	URL string
	log log.Logger
}

// Notify sends the alert notification to wechat work.
func (ww *WechatWorkNotifier) Notify(evalContext *alerting.EvalContext) error {
	ww.log.Info("Sending wechat work")

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		ww.log.Error("Failed to get messageUrl", "error", err, "wechatwork", ww.Name)
	}

	message := evalContext.Rule.Message
	for i, match := range evalContext.EvalMatches {
		message += fmt.Sprintf("\n>%2d. %s: %s", i+1, match.Metric, match.Value)
	}

	mm := &MarkdownMsg{
		Msgtype: "markdown",
	}
	mm.Markdown.Content = fmt.Sprintf("%s\n \n[OPEN IN GRAFANA](%s) \nGrafana v %s | %s \n", message, ruleURL, setting.BuildVersion, (time.Now()).Format(time.RFC3339))

	body, err := json.Marshal(mm)
	if err != nil {
		ww.log.Error("Failed to create Json data", "error", err, "wechatwork", ww.Name)
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:        ww.URL,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/json; charset=UTF-8",
		},
		Body: string(body),
	}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		ww.log.Error("Failed to send Wechat work", "error", err, "wechatwork", ww.Name)
		return err
	}

	return nil
}

// MarkdownMsg
type MarkdownMsg struct {
	Msgtype  string `json:"msgtype"`
	Markdown struct {
		Content string `json:"content"`
	} `json:"markdown"`
}
