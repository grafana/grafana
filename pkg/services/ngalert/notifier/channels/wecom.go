package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
)

var weComEndpoint = "https://qyapi.weixin.qq.com"

const defaultWeComChannelType = "groupRobot"
const defaultWeComMsgType = WeComMsgTypeMarkdown
const defaultWeComToUser = "@all"

type WeComMsgType string

const WeComMsgTypeMarkdown WeComMsgType = "markdown" // use these in available_channels.go too
const WeComMsgTypeText WeComMsgType = "text"

// IsValid checks wecom message type
func (mt WeComMsgType) IsValid() bool {
	return mt == WeComMsgTypeMarkdown || mt == WeComMsgTypeText
}

type wecomSettings struct {
	channel     string
	EndpointURL string       `json:"endpointUrl,omitempty" yaml:"endpointUrl,omitempty"`
	URL         string       `json:"url" yaml:"url"`
	AgentID     string       `json:"agent_id,omitempty" yaml:"agent_id,omitempty"`
	CorpID      string       `json:"corp_id,omitempty" yaml:"corp_id,omitempty"`
	Secret      string       `json:"secret,omitempty" yaml:"secret,omitempty"`
	MsgType     WeComMsgType `json:"msgtype,omitempty" yaml:"msgtype,omitempty"`
	Message     string       `json:"message,omitempty" yaml:"message,omitempty"`
	Title       string       `json:"title,omitempty" yaml:"title,omitempty"`
	ToUser      string       `json:"touser,omitempty" yaml:"touser,omitempty"`
}

func buildWecomSettings(factoryConfig FactoryConfig) (wecomSettings, error) {
	var settings = wecomSettings{
		channel: defaultWeComChannelType,
	}

	err := factoryConfig.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if len(settings.EndpointURL) == 0 {
		settings.EndpointURL = weComEndpoint
	}

	if !settings.MsgType.IsValid() {
		settings.MsgType = defaultWeComMsgType
	}

	if len(settings.Message) == 0 {
		settings.Message = DefaultMessageEmbed
	}
	if len(settings.Title) == 0 {
		settings.Title = DefaultMessageTitleEmbed
	}
	if len(settings.ToUser) == 0 {
		settings.ToUser = defaultWeComToUser
	}

	settings.URL = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "url", settings.URL)
	settings.Secret = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "secret", settings.Secret)

	if len(settings.URL) == 0 && len(settings.Secret) == 0 {
		return settings, errors.New("either url or secret is required")
	}

	if len(settings.URL) == 0 {
		settings.channel = "apiapp"
		if len(settings.AgentID) == 0 {
			return settings, errors.New("could not find AgentID in settings")
		}
		if len(settings.CorpID) == 0 {
			return settings, errors.New("could not find CorpID in settings")
		}
	}

	return settings, nil
}

func WeComFactory(fc FactoryConfig) (NotificationChannel, error) {
	ch, err := buildWecomNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

func buildWecomNotifier(factoryConfig FactoryConfig) (*WeComNotifier, error) {
	settings, err := buildWecomSettings(factoryConfig)
	if err != nil {
		return nil, err
	}
	return &WeComNotifier{
		Base:     NewBase(factoryConfig.Config.UID, factoryConfig.Config.Name, factoryConfig.Config.Type, factoryConfig.Config.DisableResolveMessage),
		tmpl:     factoryConfig.Template,
		log:      log.New("alerting.notifier.wecom"),
		ns:       factoryConfig.NotificationService,
		settings: settings,
	}, nil
}

// WeComNotifier is responsible for sending alert notifications to WeCom.
type WeComNotifier struct {
	*Base
	tmpl        *template.Template
	log         log.Logger
	ns          WebhookSender
	settings    wecomSettings
	tok         *WeComAccessToken
	tokExpireAt time.Time
	group       singleflight.Group
}

// Notify send an alert notification to WeCom.
func (w *WeComNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	w.log.Info("executing WeCom notification", "notification", w.Name)

	var tmplErr error
	tmpl, _ := TmplText(ctx, w.tmpl, as, w.log, &tmplErr)

	bodyMsg := map[string]interface{}{
		"msgtype": w.settings.MsgType,
	}
	content := fmt.Sprintf("# %s\n%s\n",
		tmpl(w.settings.Title),
		tmpl(w.settings.Message),
	)
	if w.settings.MsgType != defaultWeComMsgType {
		content = fmt.Sprintf("%s\n%s\n",
			tmpl(w.settings.Title),
			tmpl(w.settings.Message),
		)
	}

	msgType := string(w.settings.MsgType)
	bodyMsg[msgType] = map[string]interface{}{
		"content": content,
	}

	url := w.settings.URL
	if w.settings.channel != defaultWeComChannelType {
		bodyMsg["agentid"] = w.settings.AgentID
		bodyMsg["touser"] = w.settings.ToUser
		token, err := w.GetAccessToken(ctx)
		if err != nil {
			return false, err
		}
		url = fmt.Sprintf(w.settings.EndpointURL+"/cgi-bin/message/send?access_token=%s", token)
	}

	body, err := json.Marshal(bodyMsg)
	if err != nil {
		return false, err
	}

	if tmplErr != nil {
		w.log.Warn("failed to template WeCom message", "error", tmplErr.Error())
	}

	cmd := &SendWebhookSettings{
		Url:  url,
		Body: string(body),
	}

	if err = w.ns.SendWebhook(ctx, cmd); err != nil {
		w.log.Error("failed to send WeCom webhook", "error", err, "notification", w.Name)
		return false, err
	}

	return true, nil
}

// GetAccessToken returns the access token for apiapp
func (w *WeComNotifier) GetAccessToken(ctx context.Context) (string, error) {
	t := w.tok
	if w.tokExpireAt.Before(time.Now()) || w.tok == nil {
		// avoid multiple calls when there are multiple alarms
		tok, err, _ := w.group.Do("GetAccessToken", func() (interface{}, error) {
			return w.getAccessToken(ctx)
		})
		if err != nil {
			return "", err
		}
		t = tok.(*WeComAccessToken)
		// expire five minutes in advance to avoid using it when it is about to expire
		w.tokExpireAt = time.Now().Add(time.Second * time.Duration(t.ExpireIn-300))
		w.tok = t
	}
	return t.AccessToken, nil
}

type WeComAccessToken struct {
	AccessToken string `json:"access_token"`
	ErrMsg      string `json:"errmsg"`
	ErrCode     int    `json:"errcode"`
	ExpireIn    int    `json:"expire_in"`
}

func (w *WeComNotifier) getAccessToken(ctx context.Context) (*WeComAccessToken, error) {
	geTokenURL := fmt.Sprintf(w.settings.EndpointURL+"/cgi-bin/gettoken?corpid=%s&corpsecret=%s", w.settings.CorpID, w.settings.Secret)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, geTokenURL, nil)
	if err != nil {
		return nil, err
	}

	request.Header.Add("Content-Type", "application/json")
	request.Header.Add("User-Agent", "Grafana")

	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("WeCom returned statuscode invalid status code: %v", resp.Status)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	var accessToken WeComAccessToken
	err = json.NewDecoder(resp.Body).Decode(&accessToken)
	if err != nil {
		return nil, err
	}

	if accessToken.ErrCode != 0 {
		return nil, fmt.Errorf("WeCom returned errmsg: %s", accessToken.ErrMsg)
	}
	return &accessToken, nil
}

func (w *WeComNotifier) SendResolved() bool {
	return !w.GetDisableResolveMessage()
}
