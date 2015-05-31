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
	url      string
	exchange string
	conn     *amqp.Connection
	channel  *amqp.Channel
)

func getConnection() (*amqp.Connection, error) {
	c, err := amqp.Dial(url)
	if err != nil {
		return nil, err
	}
	return c, err
}

func getChannel() (*amqp.Channel, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}

	err = ch.ExchangeDeclare(
		exchange, // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return nil, err
	}
	return ch, err
}

func Init() {
	sec := setting.Cfg.Section("event_publisher")

	if !sec.Key("enabled").MustBool(false) {
		return
	}

	url = sec.Key("rabbitmq_url").String()
	exchange = sec.Key("exchange").String()
	bus.AddWildcardListener(eventListener)

	if err := Setup(); err != nil {
		log.Fatal(4, "Failed to connect to notification queue: %v", err)
		return
	}
}

// Every connection should declare the topology they expect
func Setup() error {
	c, err := getConnection()
	if err != nil {
		return err
	}
	conn = c
	ch, err := getChannel()
	if err != nil {
		return err
	}

	channel = ch

	// listen for close events so we can reconnect.
	errChan := channel.NotifyClose(make(chan *amqp.Error))
	go func() {
		for e := range errChan {
			fmt.Println("connection to rabbitmq lost.")
			fmt.Println(e)
			fmt.Println("attempting to create new rabbitmq channel.")
			ch, err := getChannel()
			if err == nil {
				channel = ch
				break
			}

			//could not create channel, so lets close the connection
			// and re-create.
			_ = conn.Close()

			for err != nil {
				time.Sleep(2 * time.Second)
				fmt.Println("attempting to reconnect to rabbitmq.")
				err = Setup()
			}
			fmt.Println("Connected to rabbitmq again.")
		}
	}()

	return nil
}

func Publish(routingKey string, msgString []byte) {
	for {
		err := channel.Publish(
			exchange,   //exchange
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
	go Publish(routingKey, msgString)
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
