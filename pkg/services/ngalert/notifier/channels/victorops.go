package channels

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// victoropsAlertStateCritical - Victorops uses "CRITICAL" string to indicate "Alerting" state
	victoropsAlertStateCritical = "CRITICAL"

	// victoropsAlertStateRecovery - VictorOps "RECOVERY" message type
	victoropsAlertStateRecovery = "RECOVERY"
)

type VictorOpsConfig struct {
	*NotificationChannelConfig
	URL         string
	MessageType string
}

func VictorOpsFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewVictorOpsConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewVictoropsNotifier(cfg, fc.ImageStore, fc.NotificationService, fc.Template), nil
}

func NewVictorOpsConfig(config *NotificationChannelConfig) (*VictorOpsConfig, error) {
	url := config.Settings.Get("url").MustString()
	if url == "" {
		return nil, errors.New("could not find victorops url property in settings")
	}
	return &VictorOpsConfig{
		NotificationChannelConfig: config,
		URL:                       url,
		MessageType:               config.Settings.Get("messageType").MustString(),
	}, nil
}

// NewVictoropsNotifier creates an instance of VictoropsNotifier that
// handles posting notifications to Victorops REST API
func NewVictoropsNotifier(config *VictorOpsConfig, images ImageStore, ns notifications.WebhookSender, t *template.Template) *VictoropsNotifier {
	return &VictoropsNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		URL:         config.URL,
		MessageType: config.MessageType,
		log:         log.New("alerting.notifier.victorops"),
		images:      images,
		ns:          ns,
		tmpl:        t,
	}
}

// VictoropsNotifier defines URL property for Victorops REST API
// and handles notification process by formatting POST body according to
// Victorops specifications (http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/)
type VictoropsNotifier struct {
	*Base
	URL         string
	MessageType string
	log         log.Logger
	images      ImageStore
	ns          notifications.WebhookSender
	tmpl        *template.Template
}

// Notify sends notification to Victorops via POST to URL endpoint
func (vn *VictoropsNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	vn.log.Debug("executing victorops notification", "notification", vn.Name)

	var tmplErr error
	tmpl, _ := TmplText(ctx, vn.tmpl, as, vn.log, &tmplErr)

	messageType := strings.ToUpper(tmpl(vn.MessageType))
	if messageType == "" {
		messageType = victoropsAlertStateCritical
	}
	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved {
		messageType = victoropsAlertStateRecovery
	}

	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("message_type", messageType)
	bodyJSON.Set("entity_id", groupKey.Hash())
	bodyJSON.Set("entity_display_name", tmpl(DefaultMessageTitleEmbed))
	bodyJSON.Set("timestamp", time.Now().Unix())
	bodyJSON.Set("state_message", tmpl(DefaultMessageEmbed))
	bodyJSON.Set("monitoring_tool", "Grafana v"+setting.BuildVersion)

	_ = withStoredImages(ctx, vn.log, vn.images,
		func(index int, image ngmodels.Image) error {
			if image.URL != "" {
				bodyJSON.Set("image_url", image.URL)
				return ErrImagesDone
			}
			return nil
		}, as...)

	ruleURL := joinUrlPath(vn.tmpl.ExternalURL.String(), "/alerting/list", vn.log)
	bodyJSON.Set("alert_url", ruleURL)

	if tmplErr != nil {
		vn.log.Warn("failed to template VictorOps message", "err", tmplErr.Error())
		tmplErr = nil
	}

	u := tmpl(vn.URL)
	if tmplErr != nil {
		vn.log.Info("failed to template VictorOps URL", "err", tmplErr.Error(), "fallback", vn.URL)
		u = vn.URL
	}

	b, err := bodyJSON.MarshalJSON()
	if err != nil {
		return false, err
	}
	cmd := &models.SendWebhookSync{
		Url:  u,
		Body: string(b),
	}

	if err := vn.ns.SendWebhookSync(ctx, cmd); err != nil {
		vn.log.Error("Failed to send Victorops notification", "err", err, "webhook", vn.Name)
		return false, err
	}

	return true, nil
}

func (vn *VictoropsNotifier) SendResolved() bool {
	return !vn.GetDisableResolveMessage()
}
