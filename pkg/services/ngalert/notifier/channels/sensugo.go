package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

type SensuGoNotifier struct {
	*Base
	log      log.Logger
	images   ImageStore
	ns       WebhookSender
	tmpl     *template.Template
	settings sensuGoSettings
}

type sensuGoSettings struct {
	URL       string `json:"url,omitempty" yaml:"url,omitempty"`
	Entity    string `json:"entity,omitempty" yaml:"entity,omitempty"`
	Check     string `json:"check,omitempty" yaml:"check,omitempty"`
	Namespace string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Handler   string `json:"handler,omitempty" yaml:"handler,omitempty"`
	APIKey    string `json:"apikey,omitempty" yaml:"apikey,omitempty"`
	Message   string `json:"message,omitempty" yaml:"message,omitempty"`
}

func buildSensuGoConfig(fc FactoryConfig) (sensuGoSettings, error) {
	settings := sensuGoSettings{}
	err := fc.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	if settings.URL == "" {
		return settings, errors.New("could not find URL property in settings")
	}
	settings.APIKey = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "apikey", settings.APIKey)
	if settings.APIKey == "" {
		return settings, errors.New("could not find the API key property in settings")
	}
	if settings.Message == "" {
		settings.Message = DefaultMessageEmbed
	}
	return settings, nil
}

func SensuGoFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := NewSensuGoNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// NewSensuGoNotifier is the constructor for the SensuGo notifier
func NewSensuGoNotifier(fc FactoryConfig) (*SensuGoNotifier, error) {
	settings, err := buildSensuGoConfig(fc)
	if err != nil {
		return nil, err
	}
	return &SensuGoNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
			SecureSettings:        fc.Config.SecureSettings,
		}),
		log:      log.New("alerting.notifier.sensugo"),
		images:   fc.ImageStore,
		ns:       fc.NotificationService,
		tmpl:     fc.Template,
		settings: settings,
	}, nil
}

// Notify sends an alert notification to Sensu Go
func (sn *SensuGoNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	sn.log.Debug("sending Sensu Go result")

	var tmplErr error
	tmpl, _ := TmplText(ctx, sn.tmpl, as, sn.log, &tmplErr)

	// Sensu Go alerts require an entity and a check. We set it to the user-specified
	// value (optional), else we fallback and use the grafana rule anme  and ruleID.
	entity := tmpl(sn.settings.Entity)
	if entity == "" {
		entity = "default"
	}

	check := tmpl(sn.settings.Check)
	if check == "" {
		check = "default"
	}

	alerts := types.Alerts(as...)
	status := 0
	if alerts.Status() == model.AlertFiring {
		// TODO figure out about NoData old state (we used to send status 1 in that case)
		status = 2
	}

	namespace := tmpl(sn.settings.Namespace)
	if namespace == "" {
		namespace = "default"
	}

	var handlers []string
	if sn.settings.Handler != "" {
		handlers = []string{tmpl(sn.settings.Handler)}
	}

	labels := make(map[string]string)

	_ = withStoredImages(ctx, sn.log, sn.images,
		func(_ int, image Image) error {
			// If there is an image for this alert and the image has been uploaded
			// to a public URL then add it to the request. We cannot add more than
			// one image per request.
			if image.URL != "" {
				labels["imageURL"] = image.URL
				return ErrImagesDone
			}
			return nil
		}, as...)

	ruleURL := joinUrlPath(sn.tmpl.ExternalURL.String(), "/alerting/list", sn.log)
	labels["ruleURL"] = ruleURL

	bodyMsgType := map[string]interface{}{
		"entity": map[string]interface{}{
			"metadata": map[string]interface{}{
				"name":      entity,
				"namespace": namespace,
			},
		},
		"check": map[string]interface{}{
			"metadata": map[string]interface{}{
				"name":   check,
				"labels": labels,
			},
			"output":   tmpl(sn.settings.Message),
			"issued":   timeNow().Unix(),
			"interval": 86400,
			"status":   status,
			"handlers": handlers,
		},
		"ruleUrl": ruleURL,
	}

	if tmplErr != nil {
		sn.log.Warn("failed to template sensugo message", "error", tmplErr.Error())
	}

	body, err := json.Marshal(bodyMsgType)
	if err != nil {
		return false, err
	}

	cmd := &SendWebhookSettings{
		Url:        fmt.Sprintf("%s/api/core/v2/namespaces/%s/events", strings.TrimSuffix(sn.settings.URL, "/"), namespace),
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("Key %s", sn.settings.APIKey),
		},
	}
	if err := sn.ns.SendWebhook(ctx, cmd); err != nil {
		sn.log.Error("failed to send Sensu Go event", "error", err, "sensugo", sn.Name)
		return false, err
	}

	return true, nil
}

func (sn *SensuGoNotifier) SendResolved() bool {
	return !sn.GetDisableResolveMessage()
}
