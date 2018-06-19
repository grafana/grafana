package notifiers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type WeChatToken struct {
	AccessToken string `json:"access_token"`
	ErrMsg      string `json:"errmsg"`
	ErrCode     int    `json:"errcode"`
	ExpireIn    int    `json:"expire_in"`
}

type WeChatMediaId struct {
	MediaId string `json:"media_id"`
	ErrMsg  string `json:"errmsg"`
	ErrCode int    `json:"errcode"`
	CreatAt string `json:"created_at"`
	Type    string `json:"type"`
}

const (
	SEND_MESSAGE_ENDPOINT string = "https://qyapi.weixin.qq.com/cgi-bin/message/send"
	UPLOAD_IMAGE_ENDPOINT string = "https://qyapi.weixin.qq.com/cgi-bin/media/upload"
	GET_TOKEN_ENDPOINT    string = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wechat",
		Name:        "WeChat",
		Description: "Sends HTTP POST request to WeChat",
		Factory:     NewWeChatNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">WeChat settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">AgentId</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.agentid"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">CorpId</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.corpid"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Secret</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.secret"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">ToUser</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.touser"></input>
      </div>
    `,
	})
}

func NewWeChatNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	agentid := model.Settings.Get("agentid").MustString()
	if agentid == "" {
		return nil, alerting.ValidationError{Reason: "Could not find agentid property in settings"}
	}

	corpid := model.Settings.Get("corpid").MustString()
	if corpid == "" {
		return nil, alerting.ValidationError{Reason: "Could not find corpid property in settings"}
	}

	secret := model.Settings.Get("secret").MustString()
	if secret == "" {
		return nil, alerting.ValidationError{Reason: "Could not find secret property in settings"}
	}

	touser := model.Settings.Get("touser").MustString()
	if touser == "" {
		return nil, alerting.ValidationError{Reason: "Could not find touser property in settings"}
	}

	return &WeChatNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		AgentId:      agentid,
		CorpId:       corpid,
		Secret:       secret,
		ToUser:       touser,
		log:          log.New("alerting.notifier.wechat"),
	}, nil
}

func (this *WeChatNotifier) ShouldNotify(context *alerting.EvalContext) bool {
	return defaultShouldNotify(context)
}

type WeChatNotifier struct {
	NotifierBase
	AgentId string
	CorpId  string
	Secret  string
	ToUser  string
	log     log.Logger
}

func (this *WeChatNotifier) GetMediaId(path, token string) (string, error) {
	var mediaId string

	var b bytes.Buffer
	w := multipart.NewWriter(&b)

	f, err := os.Open(path)
	if err != nil {
		return mediaId, err
	}
	defer f.Close()

	fw, err := w.CreateFormFile("media", path)
	if err != nil {
		return mediaId, err
	}

	_, err = io.Copy(fw, f)
	if err != nil {
		return mediaId, err
	}
	w.Close()

	url := fmt.Sprintf(UPLOAD_IMAGE_ENDPOINT+"?access_token=%s&type=image", token)
	request, err := http.NewRequest(http.MethodPost, url, &b)
	if err != nil {
		return mediaId, err
	}

	request.Header.Add("Content-Type", w.FormDataContentType())
	request.Header.Add("User-Agent", "Grafana")

	resp, err := ctxhttp.Do(context.TODO(), http.DefaultClient, request)
	if err != nil {
		return mediaId, err
	}

	if resp.StatusCode/100 != 2 {
		return mediaId, fmt.Errorf("WeChat returned statuscode invalid status code: %v", resp.Status)
	}
	defer resp.Body.Close()

	var wechatMediaId WeChatMediaId
	err = json.NewDecoder(resp.Body).Decode(&wechatMediaId)
	if err != nil {
		return mediaId, err
	}

	if wechatMediaId.ErrCode != 0 {
		return mediaId, fmt.Errorf("WeChat returned errmsg: %s", wechatMediaId.ErrMsg)
	}

	return wechatMediaId.MediaId, nil
}

func (this *WeChatNotifier) GetAccessToken() (string, error) {
	var token string

	url := fmt.Sprintf(GET_TOKEN_ENDPOINT+"?corpid=%s&corpsecret=%s", this.CorpId, this.Secret)
	request, err := http.NewRequest(http.MethodPost, url, nil)
	if err != nil {
		return token, err
	}

	request.Header.Add("Content-Type", "application/json")
	request.Header.Add("User-Agent", "Grafana")

	resp, err := ctxhttp.Do(context.TODO(), http.DefaultClient, request)
	if err != nil {
		return token, err
	}

	if resp.StatusCode/100 != 2 {
		return token, fmt.Errorf("WeChat returned statuscode invalid status code: %v", resp.Status)
	}
	defer resp.Body.Close()

	var wechatToken WeChatToken
	err = json.NewDecoder(resp.Body).Decode(&wechatToken)
	if err != nil {
		return token, err
	}

	if wechatToken.ErrCode != 0 {
		return token, fmt.Errorf("WeChat returned errmsg: %s", wechatToken.ErrMsg)
	}
	return wechatToken.AccessToken, nil
}

func (this *WeChatNotifier) PushImage(evalContext *alerting.EvalContext, token string) error {
	mediaId, err := this.GetMediaId(evalContext.ImageOnDiskPath, token)
	if err != nil {
		return err
	}

	bodyJSON, err := simplejson.NewJson([]byte(`{
        "touser": "` + this.ToUser + `",
        "msgtype" : "image",
        "agentid": "` + this.AgentId + `",
        "image" : {
                "media_id": "` + mediaId + `"
        }
    }`))

	if err != nil {
		this.log.Error("Failed to create Json data", "error", err, "wechat", this.Name)
		return err
	}

	body, _ := bodyJSON.MarshalJSON()

	url := fmt.Sprintf(SEND_MESSAGE_ENDPOINT+"?access_token=%s", token)
	cmd := &m.SendWebhookSync{
		Url:  url,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send WeChat", "error", err, "wechat", this.Name)
		return err
	}

	return nil
}

func (this *WeChatNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending wechat")

	token, err := this.GetAccessToken()
	if err != nil {
		this.log.Error("Get AccessToken failed", err)
		return err
	}

	content := evalContext.GetNotificationTitle()
	content += "\\n\\n"

	if evalContext.Rule.State != m.AlertStateOK {
		content += "Message:\\n  " + evalContext.Rule.Message + "\\n\\n"
	}

	for index, evt := range evalContext.EvalMatches {
		if index == 0 {
			content += "Metric:\\n"
		}

		if index > 4 {
			content += "  ...\\n"
			break
		}
		content += "  " + evt.Metric + "=" + strconv.FormatFloat(evt.Value.Float64, 'f', -1, 64) + "\\n"
	}
	content += "\\n"

	if evalContext.Error != nil {
		content += "Error:\\n  " + evalContext.Error.Error() + "\\n\\n"
	}

	if evalContext.ImageOnDiskPath == "" && evalContext.ImagePublicUrl != "" {
		content += "ImageUrl:\\n  " + evalContext.ImagePublicUrl + "\\n"
	}

	bodyJSON, err := simplejson.NewJson([]byte(`{
		"touser": "` + this.ToUser + `",
		"msgtype" : "text",
		"agentid": "` + this.AgentId + `",
		"text" : {
				"content": "` + content + `"
		}
	}`))

	if err != nil {
		this.log.Error("Failed to create Json data", "error", err, "wechat", this.Name)
		return err
	}

	body, _ := bodyJSON.MarshalJSON()

	url := fmt.Sprintf(SEND_MESSAGE_ENDPOINT+"?access_token=%s", token)
	cmd := &m.SendWebhookSync{
		Url:  url,
		Body: string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send WeChat", "error", err, "wechat", this.Name)
		return err
	}

	if evalContext.ImageOnDiskPath != "" {
		err := this.PushImage(evalContext, token)
		if err != nil {
			this.log.Error("Failed to Push Image", "error", err, "path", evalContext.ImageOnDiskPath)
		}
	}

	return nil
}
