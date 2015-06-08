package eventpublisher

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"unicode"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
)

var (
	globalPublisher *rabbitmq.Publisher
)

func Init() {
	sec := setting.Cfg.Section("event_publisher")

	if !sec.Key("enabled").MustBool(false) {
		return
	}

	url := sec.Key("rabbitmq_url").String()
	exchange := sec.Key("exchange").String()
	exch := rabbitmq.Exchange{
		Name: exchange,
		ExchangeType: "topic",
		Durable: true,
	}
	globalPublisher = &rabbitmq.Publisher{Url: url, Exchange: &exch}
	err := globalPublisher.Connect()
	if err != nil {
		log.Fatal(4, "Failed to connect to notification queue: %v", err)
		return
	}
	bus.AddWildcardListener(eventListener)
}

func eventListener(event interface{}) error {
	wireEvent, err := events.ToOnWriteEvent(event)
	if err != nil {
		return err
	}

	msgString, err := json.Marshal(wireEvent)
	if err != nil {
		return err
	}

	routingKey := fmt.Sprintf("%s.%s", wireEvent.Priority, CamelToDotted(wireEvent.EventType))
	// this is run in a greenthread and we expect that publish will keep
	// retrying until the message gets sent.
	go globalPublisher.Publish(routingKey, msgString)
	return nil
}

// CamelToDotted
func CamelToDotted(s string) string {
	var result string
	var words []string
	var lastPos int
	rs := []rune(s)

	for i := 0; i < len(rs); i++ {
		if i > 0 && unicode.IsUpper(rs[i]) {
			words = append(words, s[lastPos:i])
			lastPos = i
		}
	}

	// append the last word
	if s[lastPos:] != "" {
		words = append(words, s[lastPos:])
	}

	for k, word := range words {
		if k > 0 {
			result += "."
		}

		result += strings.ToLower(word)
	}

	return result
}

func Publish(routingKey string, msgString []byte) {
	if globalPublisher != nil {
		globalPublisher.Publish(routingKey, msgString)
	}
}