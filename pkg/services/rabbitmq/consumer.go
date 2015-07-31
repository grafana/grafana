package rabbitmq

import (
	"github.com/streadway/amqp"
	"log"
	"time"
)

type ConsumerCallback func(*amqp.Delivery) error

type Queue struct {
	Name       string
	Durable    bool
	AutoDelete bool
	Exclusive  bool
	NoWait     bool
	Arguments  amqp.Table
}

type Consumer struct {
	Url        string
	Exchange   *Exchange
	Queue      *Queue
	BindingKey []string
	callback   ConsumerCallback
	conn       *amqp.Connection
	channel    *amqp.Channel
}

func (c *Consumer) Connect() error {
	err := c.getConnection()
	if err != nil {
		return err
	}
	err = c.getChannel()
	if err != nil {
		return err
	}
	if c.callback != nil {
		c.consume()
	}
	return nil
}

func (c *Consumer) getConnection() error {
	conn, err := amqp.Dial(c.Url)
	if err != nil {
		return err
	}
	c.conn = conn
	return nil
}

func (c *Consumer) getChannel() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	err = ch.ExchangeDeclare(
		c.Exchange.Name,         // name
		c.Exchange.ExchangeType, // type
		c.Exchange.Durable,      // durable
		c.Exchange.AutoDeleted,  // auto-deleted
		c.Exchange.Internal,     // internal
		c.Exchange.NoWait,       // no-wait
		c.Exchange.Arguments,    // arguments
	)
	if err != nil {
		return err
	}
	q, err := ch.QueueDeclare(
		c.Queue.Name,       // name
		c.Queue.Durable,    // durable
		c.Queue.AutoDelete, // delete when usused
		c.Queue.Exclusive,  // exclusive
		c.Queue.NoWait,     // no-wait
		c.Queue.Arguments,  // arguments
	)
	if err != nil {
		return err
	}
	for _, key := range c.BindingKey {
		err = ch.QueueBind(
			q.Name,          // queue name
			key,             // routing key
			c.Exchange.Name, // exchange
			false,
			nil,
		)
		if err != nil {
			return err
		}
	}

	c.channel = ch

	// listen for close events so we can reconnect.
	errChan := c.channel.NotifyClose(make(chan *amqp.Error))
	go func() {
		for er := range errChan {
			log.Printf("connection to rabbitmq lost. %s", er.Error())
			log.Printf("attempting to create new rabbitmq channel.")
			err := c.getChannel()
			if err == nil {
				break
			}

			//could not create channel, so lets close the connection
			// and re-create.
			_ = c.conn.Close()

			for err != nil {
				time.Sleep(2 * time.Second)
				log.Printf("attempting to reconnect to rabbitmq.")
				err = c.Connect()
			}
			log.Printf("Connected to rabbitmq again.")
		}
	}()
	return nil
}

func (c *Consumer) Consume(cb ConsumerCallback) error {
	c.callback = cb
	return c.consume()
}

func (c *Consumer) consume() error {
	msgs, err := c.channel.Consume(
		c.Queue.Name, // queue
		"",           // consumer
		false,        // auto ack
		false,        // exclusive
		false,        // no local
		false,        // no wait
		nil,          // args
	)
	if err != nil {
		return err
	}
	go func() {
		for d := range msgs {
			err = c.callback(&d)
			if err == nil {
				d.Ack(false)
			} else {
				d.Nack(false, true)
			}
		}
	}()
	return nil
}
