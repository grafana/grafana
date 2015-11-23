package rabbitmq

import (
	"fmt"
	"github.com/streadway/amqp"
	"sync"
	"time"
)

type Exchange struct {
	Name         string
	ExchangeType string
	Durable      bool
	AutoDeleted  bool
	Internal     bool
	NoWait       bool
	Arguments    amqp.Table
}

type Publisher struct {
	rw       sync.RWMutex
	Url      string
	Exchange *Exchange
	conn     *amqp.Connection
	channel  *amqp.Channel
}

func (p *Publisher) Close() {
	p.rw.Lock()
	defer p.rw.Unlock()
	_ = p.conn.Close()
}

func (p *Publisher) Reconnect() error {
	p.rw.Lock()
	defer p.rw.Unlock()

	_ = p.conn.Close()
	fmt.Println("attempting to reconnect to rabbitmq.")
	err := p.connect()

	for err != nil {
		time.Sleep(2 * time.Second)
		fmt.Println("attempting to reconnect to rabbitmq.")
		err = p.connect()
	}
	fmt.Println("Connected to rabbitmq again.")
	return nil
}

func (p *Publisher) Connect() error {
	p.rw.Lock()
	defer p.rw.Unlock()
	return p.connect()
}

func (p *Publisher) connect() error {
	err := p.getConnection()
	if err != nil {
		return err
	}
	err = p.getChannel()
	if err != nil {
		p.Close()
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
		p.Exchange.Name,         // name
		p.Exchange.ExchangeType, // type
		p.Exchange.Durable,      // durable
		p.Exchange.AutoDeleted,  // auto-deleted
		p.Exchange.Internal,     // internal
		p.Exchange.NoWait,       // no-wait
		p.Exchange.Arguments,    // arguments
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
			p.Reconnect()
		}
	}()
	return nil
}

func (p *Publisher) Publish(routingKey string, msgString []byte) {
	for {
		p.rw.RLock()
		err := p.channel.Publish(
			p.Exchange.Name, //exchange
			routingKey,      // routing key
			false,           // mandatory
			false,           // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        msgString,
			},
		)
		p.rw.RUnlock()
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
