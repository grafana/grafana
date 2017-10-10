package notifiers

import (
	"strconv"

	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "kafka",
		Name:        "Kafka REST Proxy",
		Description: "Sends notifications to Kafka Rest Proxy",
		Factory:     NewKafkaNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Kafka settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">Kafka REST Proxy</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.kafkaRestProxy" placeholder="http://localhost:8082"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">Topic</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.kafkaTopic" placeholder="topic1"></input>
      </div>
    `,
	})
}

func NewKafkaNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	endpoint := model.Settings.Get("kafkaRestProxy").MustString()
	if endpoint == "" {
		return nil, alerting.ValidationError{Reason: "Could not find kafka rest proxy endpoint property in settings"}
	}
	topic := model.Settings.Get("kafkaTopic").MustString()
	if topic == "" {
		return nil, alerting.ValidationError{Reason: "Could not find kafka topic property in settings"}
	}

	return &KafkaNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Endpoint:     endpoint,
		Topic:        topic,
		log:          log.New("alerting.notifier.kafka"),
	}, nil
}

type KafkaNotifier struct {
	NotifierBase
	Endpoint string
	Topic    string
	log      log.Logger
}

func (this *KafkaNotifier) Notify(evalContext *alerting.EvalContext) error {

	state := evalContext.Rule.State

	customData := "Triggered metrics:\n\n"
	for _, evt := range evalContext.EvalMatches {
		customData = customData + fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
	}

	this.log.Info("Notifying Kafka", "alert_state", state)

	recordJSON := simplejson.New()
	records := make([]interface{}, 1)

	bodyJSON := simplejson.New()
	bodyJSON.Set("description", evalContext.Rule.Name+" - "+evalContext.Rule.Message)
	bodyJSON.Set("client", "Grafana")
	bodyJSON.Set("details", customData)
	bodyJSON.Set("incident_key", "alertId-"+strconv.FormatInt(evalContext.Rule.Id, 10))

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}
	bodyJSON.Set("client_url", ruleUrl)

	if evalContext.ImagePublicUrl != "" {
		contexts := make([]interface{}, 1)
		imageJSON := simplejson.New()
		imageJSON.Set("type", "image")
		imageJSON.Set("src", evalContext.ImagePublicUrl)
		contexts[0] = imageJSON
		bodyJSON.Set("contexts", contexts)
	}

	valueJSON := simplejson.New()
	valueJSON.Set("value", bodyJSON)
	records[0] = valueJSON
	recordJSON.Set("records", records)
	body, _ := recordJSON.MarshalJSON()

	topicUrl := this.Endpoint + "/topics/" + this.Topic

	cmd := &m.SendWebhookSync{
		Url:        topicUrl,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/vnd.kafka.json.v2+json",
			"Accept":       "application/vnd.kafka.v2+json",
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to Kafka", "error", err, "body", string(body))
		return err
	}

	return nil
}
