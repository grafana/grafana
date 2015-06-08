package eventpublisher

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/streadway/amqp"
)

var (
	globalPublisher *EventPublisher
)

type EventPublisher struct {
	url string
	exchange string
	conn *amqp.Connection
	channel  *amqp.Channel
}

func NewEventPublisher(url string, exchange string) (*EventPublisher, error) {
	publisher := &EventPublisher{url: url, exchange: exchange}
	
	err := publisher.Connect()
	return publisher, err
}

func (e *EventPublisher) Connect() error {
	err := e.getConnection()
	if err != nil {
		return err
	}
	err = e.getChannel()
	if err != nil {
		return err
	}
	return nil
}

func (e *EventPublisher) getConnection() error {
	c, err := amqp.Dial(e.url)
	if err != nil {
		return err
	}
	e.conn = c
	return nil
}

func (e *EventPublisher) getChannel() error {
	ch, err := e.conn.Channel()
	if err != nil {
		return err
	}

	err = ch.ExchangeDeclare(
		e.exchange, // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return err
	}
	e.channel = ch
	// listen for close events so we can reconnect.
	errChan := e.channel.NotifyClose(make(chan *amqp.Error))
	go func() {
		for er := range errChan {
			fmt.Println("connection to rabbitmq lost.")
			fmt.Println(er)
			fmt.Println("attempting to create new rabbitmq channel.")
			err := e.getChannel()
			if err == nil {
				break
			}

			//could not create channel, so lets close the connection
			// and re-create.
			_ = e.conn.Close()

			for err != nil {
				time.Sleep(2 * time.Second)
				fmt.Println("attempting to reconnect to rabbitmq.")
				err = e.Connect()
			}
			fmt.Println("Connected to rabbitmq again.")
		}
	}()
	return nil
}

func (e *EventPublisher) Publish(routingKey string, msgString []byte) {
	for {
		err := e.channel.Publish(
			e.exchange,   //exchange
			routingKey, // routing key
			false,      // mandatory
			false,      // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        msgString,
			},
		)
		if err == nil {
			return
		}

		// failures are most likely because the connection was lost.
		// the connection will be re-established, so just keep
		// retrying every 2seconds until we successfully publish.
		time.Sleep(2 * time.Second)
		fmt.Println("publish failed, retrying.")
	}
}

func Init() {
	sec := setting.Cfg.Section("event_publisher")

	if !sec.Key("enabled").MustBool(false) {
		return
	}

	url := sec.Key("rabbitmq_url").String()
	exchange := sec.Key("exchange").String()
	var err error
	globalPublisher, err = NewEventPublisher(url, exchange)

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
	globalPublisher.Publish(routingKey, msgString)
}