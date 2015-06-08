package rabbitmq

import (
	"fmt"
	"time"
	"github.com/streadway/amqp"
)

type Exchange struct {
	Name string
	ExchangeType string
	Durable bool
	AutoDeleted bool
	Internal bool
	NoWait bool
	Arguments amqp.Table
}

type Publisher struct {
	Url string
	Exchange *Exchange
	conn     *amqp.Connection
	channel  *amqp.Channel
}

func (p *Publisher) Connect() error {
	err := p.getConnection()
	if err != nil {
		return err
	}
	err = p.getChannel()
	if err != nil {
		return err
	}
	return nil
}

func (p *Publisher) getConnection() error {
	c, err := amqp.Dial(p.Url)
	if err != nil {
		return err
	}
	p.conn = c
	return nil
}

func (p *Publisher) getChannel() error {
	ch, err := p.conn.Channel()
	if err != nil {
		return err
	}

	err = ch.ExchangeDeclare(
		p.Exchange.Name, // name
		p.Exchange.ExchangeType,  // type
		p.Exchange.Durable,     // durable
		p.Exchange.AutoDeleted,    // auto-deleted
		p.Exchange.Internal,    // internal
		p.Exchange.NoWait,    // no-wait
		p.Exchange.Arguments,      // arguments
	)
	if err != nil {
		return err
	}
	p.channel = ch
	// listen for close events so we can reconnect.
	errChan := p.channel.NotifyClose(make(chan *amqp.Error))
	go func() {
		for er := range errChan {
			fmt.Println("connection to rabbitmq lost.")
			fmt.Println(er)
			fmt.Println("attempting to create new rabbitmq channel.")
			err := p.getChannel()
			if err == nil {
				break
			}

			//could not create channel, so lets close the connection
			// and re-create.
			_ = p.conn.Close()

			for err != nil {
				time.Sleep(2 * time.Second)
				fmt.Println("attempting to reconnect to rabbitmq.")
				err = p.Connect()
			}
			fmt.Println("Connected to rabbitmq again.")
		}
	}()
	return nil
}

func (p *Publisher) Publish(routingKey string, msgString []byte) {
	for {
		err := p.channel.Publish(
			p.Exchange.Name,     //exchange
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