package notifiers

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"io/ioutil"
	"net/http"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wechat-work",
		Name:        "WeChat Work",
		Description: "Sends Message To WeChat Work",
		Factory:     newWeChatWorkNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">WeChat Work settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=$key"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">MessageType</span>
        <select class="gf-form-input max-width-14" ng-model="ctrl.model.settings.msgType" ng-options="s for s in ['text','markdown']" ng-init="ctrl.model.settings.msgType=ctrl.model.settings.msgType || text"></select>
      </div>
`,
	})
}

func newWeChatWorkNotifier(notification *models.AlertNotification) (alerting.Notifier, error) {
	url := notification.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}
	msgType := notification.Settings.Get("msgType").MustString()
	switch msgType {
	case "markdown":
	case "text":
	default:
		return nil, alerting.ValidationError{Reason: "Invalid msgType property in settings"}
	}

	return &weChatWorkNotifier{
		NotifierBase: NewNotifierBase(notification),
		URL:          url,
		MsgType:      msgType,
		log:          log.New("alerting.notifier.wechat-work"),
	}, nil
}

type weChatWorkNotifier struct {
	NotifierBase
	URL     string
	MsgType string
	log     log.Logger
}

func (w *weChatWorkNotifier) genTextBody(evalContext *alerting.EvalContext) (string, error) {
	bodyJSON := simplejson.New()
	bodyJSON.Set("msgtype", "text")
	textJSON := simplejson.New()
	content := fmt.Sprintf("%s\nRule Id:%d\nRule Name:%s\nState:%s\nOrgID:%d\nDashboardID:%d\nPanelID:%d", evalContext.GetNotificationTitle(), evalContext.Rule.ID, evalContext.Rule.Name, evalContext.Rule.State, evalContext.Rule.OrgID, evalContext.Rule.DashboardID, evalContext.Rule.PanelID)
	if ruleURL, err := evalContext.GetRuleURL(); err != nil {
		content = content + "\nRuleURL:" + ruleURL
	}
	if evalContext.Rule.Message != "" {
		content = content + "\nMessage:" + evalContext.Rule.Message
	}
	textJSON.Set("content", content)
	bodyJSON.Set("text", textJSON)

	body, err := bodyJSON.MarshalJSON()
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (w *weChatWorkNotifier) genMarkdownBody(evalContext *alerting.EvalContext) (string, error) {
	bodyJSON := simplejson.New()
	bodyJSON.Set("msgtype", "markdown")
	textJSON := simplejson.New()
	content := fmt.Sprintf("### %s\n**Rule Id**:%d\n**Rule Name**:%s\n**State**:%s\n**OrgID**:%d\n**DashboardID**:%d\n**PanelID**:%d", evalContext.GetNotificationTitle(), evalContext.Rule.ID, evalContext.Rule.Name, evalContext.Rule.State, evalContext.Rule.OrgID, evalContext.Rule.DashboardID, evalContext.Rule.PanelID)
	if ruleURL, err := evalContext.GetRuleURL(); err != nil {
		content = content + fmt.Sprintf("\n[RuleURL](%s)", ruleURL)
	}
	if evalContext.Rule.Message != "" {
		content = content + "\n**Message**:" + evalContext.Rule.Message
	}
	textJSON.Set("content", content)
	bodyJSON.Set("markdown", textJSON)

	body, err := bodyJSON.MarshalJSON()
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (w *weChatWorkNotifier) genImageBody(evalContext *alerting.EvalContext) (*string, error) {
	var imageData []byte
	var err error
	switch {
	case evalContext.ImageOnDiskPath != "":
		imageData, err = ioutil.ReadFile(evalContext.ImageOnDiskPath)
		if err != nil {
			w.log.Error("Failed to read image from disk")
			return nil, err
		}
	case evalContext.ImagePublicURL != "":
		imageResponse, err := http.Get(evalContext.ImagePublicURL)
		if err != nil {
			w.log.Error("Failed to read image from URL")
			return nil, err
		}
		defer imageResponse.Body.Close()
		imageData, err = ioutil.ReadAll(imageResponse.Body)
		if err != nil {
			w.log.Error("Failed to read image from http body")
			return nil, err
		}
	default:
		return nil, nil
	}
	bodyJSON := simplejson.New()
	bodyJSON.Set("msgtype", "image")
	imageJSON := simplejson.New()
	imageJSON.Set("base64", base64.StdEncoding.EncodeToString(imageData))
	hash := md5.Sum(imageData)
	imageJSON.Set("md5", hex.EncodeToString(hash[:]))
	bodyJSON.Set("image", imageJSON)

	body, err := bodyJSON.MarshalJSON()
	if err != nil {
		return nil, err
	}
	bodyString := string(body)
	return &bodyString, nil
}

func (w *weChatWorkNotifier) Notify(evalContext *alerting.EvalContext) error {
	w.log.Info("Sending WeChat Work")

	var body string
	var err error
	if w.MsgType == "text" {
		body, err = w.genTextBody(evalContext)
	} else {
		body, err = w.genMarkdownBody(evalContext)
	}
	if err != nil {
		return err
	}
	if err := w.send(evalContext.Ctx, body); err != nil {
		return err
	}

	imageBody, err := w.genImageBody(evalContext)
	if err != nil {
		return err
	}
	if imageBody == nil {
		return nil
	}
	return w.send(evalContext.Ctx, *imageBody)
}

func (w *weChatWorkNotifier) send(ctx context.Context, body string) error {
	cmd := &models.SendWebhookSync{
		Url:        w.URL,
		Body:       body,
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		w.log.Error("Failed to send WeChat Work", "error", err, "wechat-work", w.Name)
		return err
	}

	return nil
}
