package notification

import (
	"fmt"
	"time"
	"encoding/json"
	"github.com/streadway/amqp"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

var (
	url string
	exchange string
	conn *amqp.Connection
	channel *amqp.Channel
)

func getConnection() (*amqp.Connection, error) {
	c, err := amqp.Dial(url)
	if err != nil {
		return nil,  err
	}
	return c, err
}

func getChannel() (*amqp.Channel, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}

	err = ch.ExchangeDeclare(
		exchange,     // name
		"topic",      // type
		true,         // durable
		false,        // auto-deleted
		false,        // internal
		false,        // no-wait
		nil,          // arguments
	)
	if (err != nil) {
		return nil, err
	}
	return ch, err
}

func Init(rabbitUrl string, exchangeName string) error {
	url = rabbitUrl
	exchange = exchangeName
	bus.AddEventListener(NotificationHandler)
	return Setup()
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
	err := channel.Publish(
		exchange,      //exchange
		routingKey,   // routing key
		false,       // mandatory
		false,      // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body: msgString,
		},
	)
	if err != nil {
		// failures are most likely because the connection was lost.
		// the connection will be re-established, so just keep 
		// retrying every 2seconds until we successfully publish.
		time.Sleep(2 * time.Second)
		fmt.Println("publish failed, retrying.");
		Publish(routingKey, msgString)
	}
	return
}

func NotificationHandler(event *m.Notification) error {
	msgString, err := json.Marshal(event)
	if err != nil {
		return err
	}
	routingKey := fmt.Sprintf("%s.%s", event.Priority, event.EventType)
	// this is run in a greenthread and we expect that publish will keep
	// retrying until the message gets sent.
	go Publish(routingKey, msgString)
	return nil
}