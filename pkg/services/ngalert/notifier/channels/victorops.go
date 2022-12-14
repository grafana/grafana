package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// https://help.victorops.com/knowledge-base/incident-fields-glossary/ - 20480 characters.
const victorOpsMaxMessageLenRunes = 20480

const (
	// victoropsAlertStateCritical - Victorops uses "CRITICAL" string to indicate "Alerting" state
	victoropsAlertStateCritical = "CRITICAL"

	// victoropsAlertStateRecovery - VictorOps "RECOVERY" message type
	victoropsAlertStateRecovery = "RECOVERY"
)

type victorOpsSettings struct {
	URL         string `json:"url,omitempty" yaml:"url,omitempty"`
	MessageType string `json:"messageType,omitempty" yaml:"messageType,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func buildVictorOpsSettings(fc FactoryConfig) (victorOpsSettings, error) {
	settings := victorOpsSettings{}
	err := fc.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.URL == "" {
		return settings, errors.New("could not find victorops url property in settings")
	}
	if settings.MessageType == "" {
		settings.MessageType = victoropsAlertStateCritical
	}
	if settings.Title == "" {
		settings.Title = DefaultMessageTitleEmbed
	}
	if settings.Description == "" {
		settings.Description = DefaultMessageEmbed
	}
	return settings, nil
}

func VictorOpsFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := NewVictoropsNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// NewVictoropsNotifier creates an instance of VictoropsNotifier that
// handles posting notifications to Victorops REST API
func NewVictoropsNotifier(fc FactoryConfig) (*VictoropsNotifier, error) {
	settings, err := buildVictorOpsSettings(fc)
	if err != nil {
		return nil, err
	}
	return &VictoropsNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		log:      log.New("alerting.notifier.victorops"),
		images:   fc.ImageStore,
		ns:       fc.NotificationService,
		tmpl:     fc.Template,
		settings: settings,
	}, nil
}

// VictoropsNotifier defines URL property for Victorops REST API
// and handles notification process by formatting POST body according to
// Victorops specifications (http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/)
type VictoropsNotifier struct {
	*Base
	log      log.Logger
	images   ImageStore
	ns       WebhookSender
	tmpl     *template.Template
	settings victorOpsSettings
}

// Notify sends notification to Victorops via POST to URL endpoint
func (vn *VictoropsNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	vn.log.Debug("sending notification", "notification", vn.Name)

	var tmplErr error
	tmpl, _ := TmplText(ctx, vn.tmpl, as, vn.log, &tmplErr)

	messageType := buildMessageType(vn.log, tmpl, vn.settings.MessageType, as...)

	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	stateMessage, truncated := TruncateInRunes(tmpl(vn.settings.Description), victorOpsMaxMessageLenRunes)
	if truncated {
		vn.log.Warn("Truncated stateMessage", "incident", groupKey, "max_runes", victorOpsMaxMessageLenRunes)
	}

	bodyJSON := map[string]interface{}{
		"message_type":        messageType,
		"entity_id":           groupKey.Hash(),
		"entity_display_name": tmpl(vn.settings.Title),
		"timestamp":           time.Now().Unix(),
		"state_message":       stateMessage,
		"monitoring_tool":     "Grafana v" + setting.BuildVersion,
	}

	if tmplErr != nil {
		vn.log.Warn("failed to expand message template. "+
			"", "error", tmplErr.Error())
		tmplErr = nil
	}

	_ = withStoredImages(ctx, vn.log, vn.images,
		func(index int, image Image) error {
			if image.URL != "" {
				bodyJSON["image_url"] = image.URL
				return ErrImagesDone
			}
			return nil
		}, as...)

	ruleURL := joinUrlPath(vn.tmpl.ExternalURL.String(), "/alerting/list", vn.log)
	bodyJSON["alert_url"] = ruleURL

	u := tmpl(vn.settings.URL)
	if tmplErr != nil {
		vn.log.Info("failed to expand URL template", "error", tmplErr.Error(), "fallback", vn.settings.URL)
		u = vn.settings.URL
	}

	b, err := json.Marshal(bodyJSON)
	if err != nil {
		return false, err
	}
	cmd := &SendWebhookSettings{
		Url:  u,
		Body: string(b),
	}

	if err := vn.ns.SendWebhook(ctx, cmd); err != nil {
		vn.log.Error("failed to send notification", "error", err, "webhook", vn.Name)
		return false, err
	}

	return true, nil
}

func (vn *VictoropsNotifier) SendResolved() bool {
	return !vn.GetDisableResolveMessage()
}

func buildMessageType(l log.Logger, tmpl func(string) string, msgType string, as ...*types.Alert) string {
	if types.Alerts(as...).Status() == model.AlertResolved {
		return victoropsAlertStateRecovery
	}
	if messageType := strings.ToUpper(tmpl(msgType)); messageType != "" {
		return messageType
	}
	l.Warn("expansion of message type template resulted in an empty string. Using fallback", "fallback", victoropsAlertStateCritical, "template", msgType)
	return victoropsAlertStateCritical
}
