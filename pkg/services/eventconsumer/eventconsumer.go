package eventconsumer

import (
	"log"
	"time"
	"github.com/streadway/amqp"
)

type EventConsumerCallback func(*amqp.Delivery) error

type EventConsumer struct {
	url string
	exchange string
	bindingKey string
	queue *amqp.Queue
	conn *amqp.Connection
	channel  *amqp.Channel
	callback EventConsumerCallback
}

func NewEventConsumer(url string, exchange string, bindingKey string) (*EventConsumer, error) {
	consumer := &EventConsumer{url: url, exchange: exchange, bindingKey: bindingKey}
	
	err := consumer.Connect()
	return consumer, err
}

func (e *EventConsumer) Connect() error {
	err := e.getConnection()
	if err != nil {
		return err
	}
	err = e.getChannel()
	if err != nil {
		return err
	}
	if e.callback != nil {
		e.consume()
	}
	return nil
}

func (e *EventConsumer) getConnection() error {
	c, err := amqp.Dial(e.url)
	if err != nil {
		return err
	}
	e.conn = c
	return nil
}

func (e *EventConsumer) getChannel() error {
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
	q, err := ch.QueueDeclare(
		"",    // name
		false, // durable
		false, // delete when usused
		true,  // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return err
	}
	err = ch.QueueBind(
		q.Name,       // queue name
		e.bindingKey, // routing key
		e.exchange,   // exchange
		false,
		nil)

	if err != nil {
		return err
	}
	e.queue = &q
	e.channel = ch

	// listen for close events so we can reconnect.
	errChan := e.channel.NotifyClose(make(chan *amqp.Error))
	go func() {
		for er := range errChan {
			log.Printf("connection to rabbitmq lost. %s", er.Error())
			log.Printf("attempting to create new rabbitmq channel.")
			err := e.getChannel()
			if err == nil {
				break
			}

			//could not create channel, so lets close the connection
			// and re-create.
			_ = e.conn.Close()

			for err != nil {
				time.Sleep(2 * time.Second)
				log.Printf("attempting to reconnect to rabbitmq.")
				err = e.Connect()
			}
			log.Printf("Connected to rabbitmq again.")
		}
	}()
	return nil
}

func (e *EventConsumer) Consume(cb EventConsumerCallback) error {
	e.callback = cb
	return e.consume()
}

func (e *EventConsumer) consume() error {
	msgs, err := e.channel.Consume(
		e.queue.Name, // queue
		"",     // consumer
		false,   // auto ack
		false,  // exclusive
		false,  // no local
		false,  // no wait
		nil,    // args
	)
	if err != nil {
		return err
	}
	go func() {
		for d := range msgs {
			err = e.callback(&d)
			if err == nil {
				d.Ack(false)
			}
		}
	}()
	return nil
}
