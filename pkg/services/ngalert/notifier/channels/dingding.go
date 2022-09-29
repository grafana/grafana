package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

const defaultDingdingMsgType = "link"

type DingDingConfig struct {
	*NotificationChannelConfig
	MsgType string
	Message string
	URL     string
}

func NewDingDingConfig(config *NotificationChannelConfig) (*DingDingConfig, error) {
	url := config.Settings.Get("url").MustString()
	if url == "" {
		return nil, errors.New("could not find url property in settings")
	}
	return &DingDingConfig{
		NotificationChannelConfig: config,
		MsgType:                   config.Settings.Get("msgType").MustString(defaultDingdingMsgType),
		Message:                   config.Settings.Get("message").MustString(DefaultMessageEmbed),
		URL:                       config.Settings.Get("url").MustString(),
	}, nil
}
func DingDingFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewDingDingConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewDingDingNotifier(cfg, fc.NotificationService, fc.Template), nil
}

// NewDingDingNotifier is the constructor for the Dingding notifier
func NewDingDingNotifier(config *DingDingConfig, ns notifications.WebhookSender, t *template.Template) *DingDingNotifier {
	return &DingDingNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		MsgType: config.MsgType,
		Message: config.Message,
		URL:     config.URL,
		log:     log.New("alerting.notifier.dingding"),
		tmpl:    t,
		ns:      ns,
	}
}

// DingDingNotifier is responsible for sending alert notifications to ding ding.
type DingDingNotifier struct {
	*Base
	MsgType string
	URL     string
	Message string
	tmpl    *template.Template
	ns      notifications.WebhookSender
	log     log.Logger
}

// Notify sends the alert notification to dingding.
func (dd *DingDingNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	dd.log.Info("sending dingding")

	ruleURL := joinUrlPath(dd.tmpl.ExternalURL.String(), "/alerting/list", dd.log)

	q := url.Values{
		"pc_slide": {"false"},
		"url":      {ruleURL},
	}

	// Use special link to auto open the message url outside of Dingding
	// Refer: https://open-doc.dingtalk.com/docs/doc.htm?treeId=385&articleId=104972&docType=1#s9
	messageURL := "dingtalk://dingtalkclient/page/link?" + q.Encode()

	var tmplErr error
	tmpl, _ := TmplText(ctx, dd.tmpl, as, dd.log, &tmplErr)

	message := tmpl(dd.Message)
	title := tmpl(DefaultMessageTitleEmbed)

	var bodyMsg map[string]interface{}
	if tmpl(dd.MsgType) == "actionCard" {
		bodyMsg = map[string]interface{}{
			"msgtype": "actionCard",
			"actionCard": map[string]string{
				"text":        message,
				"title":       title,
				"singleTitle": "More",
				"singleURL":   messageURL,
			},
		}
	} else {
		link := map[string]string{
			"text":       message,
			"title":      title,
			"messageUrl": messageURL,
		}

		bodyMsg = map[string]interface{}{
			"msgtype": "link",
			"link":    link,
		}
	}

	if tmplErr != nil {
		dd.log.Warn("failed to template DingDing message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(dd.URL)
	if tmplErr != nil {
		dd.log.Warn("failed to template DingDing URL", "err", tmplErr.Error(), "fallback", dd.URL)
		u = dd.URL
	}

	body, err := json.Marshal(bodyMsg)
	if err != nil {
		return false, err
	}

	cmd := &models.SendWebhookSync{
		Url:  u,
		Body: string(body),
	}

	if err := dd.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, fmt.Errorf("send notification to dingding: %w", err)
	}

	return true, nil
}

func (dd *DingDingNotifier) SendResolved() bool {
	return !dd.GetDisableResolveMessage()
}
