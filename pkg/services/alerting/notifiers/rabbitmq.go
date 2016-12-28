package notifiers

import (
  "fmt"
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/metrics"
  m "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/services/alerting"
  "github.com/grafana/grafana/pkg/components/simplejson"
)

func init() {
  alerting.RegisterNotifier("rabbitmq", NewRabbitMQNotifier)
}

type RabbitMQNotifier struct {
  NotifierBase
  HostAddress string
  Username    string
  Password    string
  VHost       string
  Exchange    string
  log       log.Logger
}

func NewRabbitMQNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
  if model.Settings == nil {
    return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
  }

  hostAddress := model.Settings.Get("hostaddress").MustString()
  username := model.Settings.Get("username").MustString()
  password := model.Settings.Get("password").MustString()
  vhost := model.Settings.Get("vhost").MustString()
  exchange := model.Settings.Get("exchange").MustString()


  if hostAddress == "" {
    return nil, alerting.ValidationError{Reason: "Could not find host address in settings"}
  }

  if username == "" {
    return nil, alerting.ValidationError{Reason: "Could not find host username in settings"}
  }

  if password == "" {
    return nil, alerting.ValidationError{Reason: "Could not find host password in settings"}
  }

  if vhost == "" {
    return nil, alerting.ValidationError{Reason: "Could not find host vhost in settings"}
  }

  if exchange == "" {
    return nil, alerting.ValidationError{Reason: "Could not find host exchange in settings"}
  }

    return &RabbitMQNotifier{
    NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
    HostAddress:    hostAddress,
      Username: username,
      Password: password,
      VHost: vhost,
      Exchange: exchange,
    log:          log.New("alerting.notifier.rabbitmq"),
  }, nil
}

func (this *RabbitMQNotifier) Notify(evalContext *alerting.EvalContext) error {
  this.log.Info("Sending alert notification to", "host", this.HostAddress)
  this.log.Info("Sending alert notification to", "username", this.Username)
  this.log.Info("Sending alert notification to", "password", this.Password)
  this.log.Info("Sending alert notification to", "vhost", this.VHost)
  this.log.Info("Sending alert notification to", "exchange", this.Exchange)
  metrics.M_Alerting_Notification_Sent_RabbitMQ.Inc(1)

  bodyJSON := simplejson.New()
  bodyJSON.Set("title", evalContext.GetNotificationTitle())
  bodyJSON.Set("ruleId", evalContext.Rule.Id)
  bodyJSON.Set("ruleName", evalContext.Rule.Name)
  bodyJSON.Set("state", evalContext.Rule.State)
  bodyJSON.Set("evalMatches", evalContext.EvalMatches)

  ruleUrl, err := evalContext.GetRuleUrl()
  if err == nil {
    bodyJSON.Set("ruleUrl", ruleUrl)
  }

  if evalContext.Rule.Message != "" {
    bodyJSON.Set("message", evalContext.Rule.Message)
  }



  url := fmt.Sprintf("http://%s:%s@%s:15672/api/exchanges/%s/%s/publish", this.Username, this.Password, this.HostAddress, this.VHost, this.Exchange)
  body, _ := bodyJSON.MarshalJSON()
  props := make([]string, 0)

  messageJson := simplejson.New()
  messageJson.Set("properties",  props)
  messageJson.Set("vhost", this.VHost)
  messageJson.Set("name", this.Exchange)
  messageJson.Set("routing_key", this.Exchange)
  messageJson.Set("delivery_mode","1")
  messageJson.Set("payload", string(body))
  messageJson.Set("payload_encoding", "string");

  message, _ := messageJson.MarshalJSON()

  cmd := &m.SendWebhookSync{
    Url:        url,
    User:       this.Username,
    Password:   this.Password,
    Body:       string(message),
    HttpMethod: "POST",
  }

  if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
    this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
    return err
  }

  return nil

}
