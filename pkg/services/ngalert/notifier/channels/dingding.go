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

func DingDingFactory(fc FactoryConfig) (NotificationChannel, error) {
	ch, err := buildDingDingNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

func buildDingDingNotifier(fc FactoryConfig) (*DingDingNotifier, error) {
	url := fc.Config.Settings.Get("url").MustString()
	if url == "" {
		return nil, errors.New("could not find url property in settings")
	}

	return &DingDingNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		MsgType: fc.Config.Settings.Get("msgType").MustString(defaultDingdingMsgType),
		Message: fc.Config.Settings.Get("message").MustString(DefaultMessageEmbed),
		URL:     fc.Config.Settings.Get("url").MustString(),
		log:     log.New("alerting.notifier.dingding"),
		tmpl:    fc.Template,
		ns:      fc.NotificationService,
	}, nil
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
