package notifiers

import (
  "testing"

  "github.com/grafana/grafana/pkg/components/simplejson"
  m "github.com/grafana/grafana/pkg/models"
  . "github.com/smartystreets/goconvey/convey"
)

func TestRabbitMQNotifier(t *testing.T) {
  Convey("RabbitMQ notifier tests", t, func() {

    Convey("Parsing alert notification from settings", func() {
      Convey("empty settings should return error", func() {
        json := `{ }`

        settingsJSON, _ := simplejson.NewJson([]byte(json))
        model := &m.AlertNotification{
          Name:     "ops",
          Type:     "rabbitmq",
          Settings: settingsJSON,
        }

        _, err := NewRabbitMQNotifier(model)
        So(err, ShouldNotBeNil)
      })

      Convey("from settings", func() {
        json := `
				{
          "hostaddress": "rabbitmq",
          "username":"guest",
          "password":"guest",
          "vhost":"Live",
          "exchange":"alerts"
				}`

        settingsJSON, _ := simplejson.NewJson([]byte(json))
        model := &m.AlertNotification{
          Name:     "ops",
          Type:     "rabbitmq",
          Settings: settingsJSON,
        }

        not, err := NewRabbitMQNotifier(model)
        rabbitmqNotifier := not.(*RabbitMQNotifier)

        So(err, ShouldBeNil)
        So(rabbitmqNotifier.Name, ShouldEqual, "ops")
        So(rabbitmqNotifier.Type, ShouldEqual, "rabbitmq")
        So(rabbitmqNotifier.HostAddress, ShouldEqual, "rabbitmq")
        So(rabbitmqNotifier.Username, ShouldEqual, "guest")
        So(rabbitmqNotifier.Password, ShouldEqual, "guest")
        So(rabbitmqNotifier.Exchange, ShouldEqual, "alerts")
        So(rabbitmqNotifier.VHost, ShouldEqual, "Live")
      })
    })
  })
}
