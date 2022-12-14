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
)

// KafkaNotifier is responsible for sending
// alert notifications to Kafka.
type KafkaNotifier struct {
	*Base
	log      log.Logger
	images   ImageStore
	ns       WebhookSender
	tmpl     *template.Template
	settings kafkaSettings
}

type kafkaSettings struct {
	Endpoint    string
	Topic       string
	Description string
	Details     string
}

func KafkaFactory(fc FactoryConfig) (NotificationChannel, error) {
	ch, err := newKafkaNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

// newKafkaNotifier is the constructor function for the Kafka notifier.
func newKafkaNotifier(fc FactoryConfig) (*KafkaNotifier, error) {
	endpoint := fc.Config.Settings.Get("kafkaRestProxy").MustString()
	if endpoint == "" {
		return nil, errors.New("could not find kafka rest proxy endpoint property in settings")
	}
	topic := fc.Config.Settings.Get("kafkaTopic").MustString()
	if topic == "" {
		return nil, errors.New("could not find kafka topic property in settings")
	}
	description := fc.Config.Settings.Get("description").MustString(DefaultMessageTitleEmbed)
	details := fc.Config.Settings.Get("details").MustString(DefaultMessageEmbed)

	return &KafkaNotifier{
		Base:     NewBase(fc.Config.UID, fc.Config.Name, fc.Config.Type, fc.Config.DisableResolveMessage),
		log:      log.New("alerting.notifier.kafka"),
		images:   fc.ImageStore,
		ns:       fc.NotificationService,
		tmpl:     fc.Template,
		settings: kafkaSettings{Endpoint: endpoint, Topic: topic, Description: description, Details: details},
	}, nil
}

// Notify sends the alert notification.
func (kn *KafkaNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	var tmplErr error
	tmpl, _ := TmplText(ctx, kn.tmpl, as, kn.log, &tmplErr)

	topicURL := strings.TrimRight(kn.settings.Endpoint, "/") + "/topics/" + tmpl(kn.settings.Topic)

	body, err := kn.buildBody(ctx, tmpl, as...)
	if err != nil {
		return false, err
	}

	if tmplErr != nil {
		kn.log.Warn("failed to template Kafka message", "error", tmplErr.Error())
	}

	cmd := &SendWebhookSettings{
		Url:        topicURL,
		Body:       body,
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/vnd.kafka.json.v2+json",
			"Accept":       "application/vnd.kafka.v2+json",
		},
	}

	if err = kn.ns.SendWebhook(ctx, cmd); err != nil {
		kn.log.Error("Failed to send notification to Kafka", "error", err, "body", body)
		return false, err
	}

	return true, nil
}

func (kn *KafkaNotifier) SendResolved() bool {
	return !kn.GetDisableResolveMessage()
}

func (kn *KafkaNotifier) buildBody(ctx context.Context, tmpl func(string) string, as ...*types.Alert) (string, error) {
	bodyJSON := simplejson.New()
	bodyJSON.Set("client", "Grafana")
	bodyJSON.Set("description", tmpl(kn.settings.Description))
	bodyJSON.Set("details", tmpl(kn.settings.Details))

	state := buildState(as...)
	kn.log.Debug("notifying Kafka", "alert_state", state)
	bodyJSON.Set("alert_state", state)

	ruleURL := joinUrlPath(kn.tmpl.ExternalURL.String(), "/alerting/list", kn.log)
	bodyJSON.Set("client_url", ruleURL)

	contexts := buildContextImages(ctx, kn.log, kn.images, as...)
	if len(contexts) > 0 {
		bodyJSON.Set("contexts", contexts)
	}

	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return "", err
	}
	bodyJSON.Set("incident_key", groupKey.Hash())

	valueJSON := simplejson.New()
	valueJSON.Set("value", bodyJSON)

	recordJSON := simplejson.New()
	recordJSON.Set("records", []interface{}{valueJSON})

	body, err := recordJSON.MarshalJSON()
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func buildState(as ...*types.Alert) models.AlertStateType {
	// We are using the state from 7.x to not break kafka.
	// TODO: should we switch to the new ones?
	if types.Alerts(as...).Status() == model.AlertResolved {
		return models.AlertStateOK
	}
	return models.AlertStateAlerting
}

func buildContextImages(ctx context.Context, l log.Logger, imageStore ImageStore, as ...*types.Alert) []interface{} {
	var contexts []interface{}
	_ = withStoredImages(ctx, l, imageStore,
		func(_ int, image Image) error {
			if image.URL != "" {
				imageJSON := simplejson.New()
				imageJSON.Set("type", "image")
				imageJSON.Set("src", image.URL)
				contexts = append(contexts, imageJSON)
			}
			return nil
		}, as...)
	return contexts
}
