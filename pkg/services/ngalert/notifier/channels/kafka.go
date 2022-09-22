package channels

import (
	"context"
	"errors"
	"strings"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

// KafkaNotifier is responsible for sending
// alert notifications to Kafka.
type KafkaNotifier struct {
	*Base
	Endpoint string
	Topic    string
	log      log.Logger
	images   ImageStore
	ns       notifications.WebhookSender
	tmpl     *template.Template
}

type KafkaConfig struct {
	*NotificationChannelConfig
	Endpoint string
	Topic    string
}

func KafkaFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewKafkaConfig(fc.Config)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewKafkaNotifier(cfg, fc.ImageStore, fc.NotificationService, fc.Template), nil
}

func NewKafkaConfig(config *NotificationChannelConfig) (*KafkaConfig, error) {
	endpoint := config.Settings.Get("kafkaRestProxy").MustString()
	if endpoint == "" {
		return nil, errors.New("could not find kafka rest proxy endpoint property in settings")
	}
	topic := config.Settings.Get("kafkaTopic").MustString()
	if topic == "" {
		return nil, errors.New("could not find kafka topic property in settings")
	}
	return &KafkaConfig{
		NotificationChannelConfig: config,
		Endpoint:                  endpoint,
		Topic:                     topic,
	}, nil
}

// NewKafkaNotifier is the constructor function for the Kafka notifier.
func NewKafkaNotifier(config *KafkaConfig, images ImageStore, ns notifications.WebhookSender, t *template.Template) *KafkaNotifier {
	return &KafkaNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		Endpoint: config.Endpoint,
		Topic:    config.Topic,
		log:      log.New("alerting.notifier.kafka"),
		images:   images,
		ns:       ns,
		tmpl:     t,
	}
}

// Notify sends the alert notification.
func (kn *KafkaNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	// We are using the state from 7.x to not break kafka.
	// TODO: should we switch to the new ones?
	alerts := types.Alerts(as...)
	state := models.AlertStateAlerting
	if alerts.Status() == model.AlertResolved {
		state = models.AlertStateOK
	}

	kn.log.Debug("notifying Kafka", "alert_state", state)

	var tmplErr error
	tmpl, _ := TmplText(ctx, kn.tmpl, as, kn.log, &tmplErr)

	bodyJSON := simplejson.New()
	bodyJSON.Set("alert_state", state)
	bodyJSON.Set("description", tmpl(DefaultMessageTitleEmbed))
	bodyJSON.Set("client", "Grafana")
	bodyJSON.Set("details", tmpl(DefaultMessageEmbed))

	ruleURL := joinUrlPath(kn.tmpl.ExternalURL.String(), "/alerting/list", kn.log)
	bodyJSON.Set("client_url", ruleURL)

	var contexts []interface{}
	_ = withStoredImages(ctx, kn.log, kn.images,
		func(_ int, image ngmodels.Image) error {
			if image.URL != "" {
				imageJSON := simplejson.New()
				imageJSON.Set("type", "image")
				imageJSON.Set("src", image.URL)
				contexts = append(contexts, imageJSON)
			}
			return nil
		}, as...)
	if len(contexts) > 0 {
		bodyJSON.Set("contexts", contexts)
	}

	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return false, err
	}
	bodyJSON.Set("incident_key", groupKey.Hash())

	valueJSON := simplejson.New()
	valueJSON.Set("value", bodyJSON)

	recordJSON := simplejson.New()
	recordJSON.Set("records", []interface{}{valueJSON})

	body, err := recordJSON.MarshalJSON()
	if err != nil {
		return false, err
	}

	topicURL := strings.TrimRight(kn.Endpoint, "/") + "/topics/" + tmpl(kn.Topic)

	if tmplErr != nil {
		kn.log.Warn("failed to template Kafka message", "err", tmplErr.Error())
	}

	cmd := &models.SendWebhookSync{
		Url:        topicURL,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/vnd.kafka.json.v2+json",
			"Accept":       "application/vnd.kafka.v2+json",
		},
	}

	if err := kn.ns.SendWebhookSync(ctx, cmd); err != nil {
		kn.log.Error("Failed to send notification to Kafka", "error", err, "body", string(body))
		return false, err
	}

	return true, nil
}

func (kn *KafkaNotifier) SendResolved() bool {
	return !kn.GetDisableResolveMessage()
}
