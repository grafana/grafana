package notifiers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"golang.org/x/net/context"
	"golang.org/x/net/context/ctxhttp"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"
)

type WeChatToken struct {
	AccessToken string `json:"access_token"`
	ErrMsg      string `json:"errmsg"`
	ErrCode     int    `json:"errcode"`
	ExpireIn    int    `json:"expire_in"`
}

type WeComMediaId struct {
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
		Type: "wecom app",
		Name: "WeCom APP",
		//Heading:	"WeCom",
		Description: "Sends alert through WeCom APP",
		Factory:     newWeComNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "CorpId",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "CorpID",
				PropertyName: "CorpId",
				Required:     true,
			},
			{
				Label:        "AgentId",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "AgentId of WeCom Application",
				PropertyName: "AgentId",
				Required:     true,
			},
			{
				Label:        "Secret",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Secret of WeCom Application",
				PropertyName: "Secret",
				Required:     true,
			},
			{
				Label:        "UserId",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "You can enter multiple UserId using a \";\" separator",
				PropertyName: "UserId",
				Required:     true,
			},
			{
				Label:        "DepartmentId",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "You can enter multiple DepartmentId using a \";\" separator. " +
					"If specified, all members will receive alert message in department",
				PropertyName: "DepartmentId",
			},
		},
	})
}

func newWeComNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	corpid := strings.ReplaceAll(model.Settings.Get("CorpId").MustString(), " ", "")
	if corpid == "" {
		return nil, alerting.ValidationError{Reason: "Could not find corpid property in settings"}
	}

	agentid := strings.ReplaceAll(model.Settings.Get("AgentId").MustString(), " ", "")
	if agentid == "" {
		return nil, alerting.ValidationError{Reason: "Could not find agentid property in settings"}
	}

	secret := strings.ReplaceAll(model.Settings.Get("Secret").MustString(), " ", "")
	if secret == "" {
		return nil, alerting.ValidationError{Reason: "Could not find secret property in settings"}
	}

	touser := strings.ReplaceAll(strings.ReplaceAll(model.Settings.Get("UserId").MustString(), " ", ""), ";", "|")

	toparty := strings.ReplaceAll(strings.ReplaceAll(model.Settings.Get("DepartmentId").MustString(), " ", ""), ";", "|")

	if touser == "" && toparty == "" {
		return nil, alerting.ValidationError{Reason: "Could not find UserId or DepartmentId property in settings, specify one at least"}
	}

	return &WeComNotifier{
		NotifierBase: NewNotifierBase(model),
		AgentId:      agentid,
		CorpId:       corpid,
		Secret:       secret,
		UserId:       touser,
		DepartmentId: toparty,
		log:          log.New("alerting.notifier.wecom"),
	}, nil
}

type WeComNotifier struct {
	NotifierBase
	AgentId      string
	CorpId       string
	Secret       string
	UserId       string
	DepartmentId string
	log          log.Logger
}

func (w *WeComNotifier) GetMediaId(path, token string) (string, error) {
	var mediaId string

	var b bytes.Buffer
	ww := multipart.NewWriter(&b)

	f, err := os.Open(path)
	if err != nil {
		return mediaId, err
	}
	defer f.Close()

	fw, err := ww.CreateFormFile("media", path)
	if err != nil {
		return mediaId, err
	}

	_, err = io.Copy(fw, f)
	if err != nil {
		return mediaId, err
	}
	ww.Close()

	url := fmt.Sprintf(UPLOAD_IMAGE_ENDPOINT+"?access_token=%s&type=image", token)
	request, err := http.NewRequest(http.MethodPost, url, &b)
	if err != nil {
		return mediaId, err
	}

	request.Header.Add("Content-Type", ww.FormDataContentType())
	request.Header.Add("User-Agent", "Grafana")

	resp, err := ctxhttp.Do(context.TODO(), http.DefaultClient, request)
	if err != nil {
		return mediaId, err
	}

	if resp.StatusCode/100 != 2 {
		return mediaId, fmt.Errorf("WeCom returned statuscode invalid status code: %v", resp.Status)
	}
	defer resp.Body.Close()

	var WeComMediaId WeComMediaId
	err = json.NewDecoder(resp.Body).Decode(&WeComMediaId)
	if err != nil {
		return mediaId, err
	}

	if WeComMediaId.ErrCode != 0 {
		return mediaId, fmt.Errorf("WeCom returned errmsg: %s", WeComMediaId.ErrMsg)
	}

	return WeComMediaId.MediaId, nil
}

func (w *WeComNotifier) GetAccessToken() (string, error) {
	var token string

	url := fmt.Sprintf(GET_TOKEN_ENDPOINT+"?corpid=%s&corpsecret=%s", w.CorpId, w.Secret)
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
		return token, fmt.Errorf("WeCom returned statuscode invalid status code: %v", resp.Status)
	}
	defer resp.Body.Close()

	var wechatToken WeChatToken
	err = json.NewDecoder(resp.Body).Decode(&wechatToken)
	if err != nil {
		return token, err
	}

	if wechatToken.ErrCode != 0 {
		return token, fmt.Errorf("WeCom returned errmsg: %s", wechatToken.ErrMsg)
	}
	return wechatToken.AccessToken, nil
}

func (w *WeComNotifier) PushImage(evalContext *alerting.EvalContext, token string) error {
	mediaId, err := w.GetMediaId(evalContext.ImageOnDiskPath, token)
	if err != nil {
		return err
	}

	im := map[string]string{
		"media_id": mediaId,
	}

	body := map[string]interface{}{
		"msgtype": "image",
		"agentid": w.AgentId,
		"image":   im,
	}

	if w.UserId != "" {
		body["touser"] = w.UserId
	}

	if w.DepartmentId != "" {
		body["toparty"] = w.DepartmentId
	}

	bodyJSON, _ := json.Marshal(body)

	url := fmt.Sprintf(SEND_MESSAGE_ENDPOINT+"?access_token=%s", token)
	cmd := &m.SendWebhookSync{
		Url:  url,
		Body: string(bodyJSON),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		w.log.Error("Failed to send WeCom", "error", err, "wecom", w.Name)
		return err
	}

	return nil
}

func (w *WeComNotifier) Notify(evalContext *alerting.EvalContext) error {
	w.log.Info("Sending wecom")

	token, err := w.GetAccessToken()
	if err != nil {
		w.log.Error("Get AccessToken failed", err)
		return err
	}

	content := evalContext.GetNotificationTitle()
	content += "\n\n"

	if evalContext.Rule.State != m.AlertStateOK {
		content += "Message:\n  " + evalContext.Rule.Message + "\n\n"
	}

	for index, evt := range evalContext.EvalMatches {
		if index == 0 {
			content += "Metric:\n"
		}

		if index > 4 {
			content += "  ...\n"
			break
		}
		content += "  " + evt.Metric + "=" + strconv.FormatFloat(evt.Value.Float64, 'f', -1, 64) + "\n"
	}
	content += "\n"

	if evalContext.Error != nil {
		content += "Error:\n  " + evalContext.Error.Error() + "\n\n"
	}

	if w.NeedsImage() && evalContext.ImageOnDiskPath == "" && evalContext.ImagePublicURL != "" {
		content += "ImageUrl:\n  " + evalContext.ImagePublicURL + "\n"
	}

	ct := map[string]string{
		"content": content,
	}

	body := map[string]interface{}{
		"msgtype": "text",
		"agentid": w.AgentId,
		"text":    ct,
	}

	if w.UserId != "" {
		body["touser"] = w.UserId
	}

	if w.DepartmentId != "" {
		body["toparty"] = w.DepartmentId
	}

	bodyJSON, _ := json.Marshal(body)

	url := fmt.Sprintf(SEND_MESSAGE_ENDPOINT+"?access_token=%s", token)
	cmd := &m.SendWebhookSync{
		Url:  url,
		Body: string(bodyJSON),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		w.log.Error("Failed to send WeCom", "error", err, "wecom", w.Name)
		return err
	}

	if w.NeedsImage() && evalContext.ImageOnDiskPath != "" {
		if err := w.PushImage(evalContext, token); err != nil {
			w.log.Error("Failed to Push Image", "error", err, "path", evalContext.ImageOnDiskPath)
		}
	}

	return nil
}
