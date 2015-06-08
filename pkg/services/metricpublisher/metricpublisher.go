package metricpublisher

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/streadway/amqp"
	"time"
)

var (
	enabled  bool
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
		exchange,            // name
		"x-consistent-hash", // type
		true,                // durable
		false,               // auto-deleted
		false,               // internal
		false,               // no-wait
		nil,                 // arguments
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
	enabled = true
	url = sec.Key("rabbitmq_url").String()
	exchange = "metricResults"

	if err := Setup(); err != nil {
		log.Fatal(4, "Failed to connect to metricResults exchange: %v", err)
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
	if !enabled {
		return
	}
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
	if err != nil {
		// failures are most likely because the connection was lost.
		// the connection will be re-established, so just keep
		// retrying every 2seconds until we successfully publish.
		time.Sleep(2 * time.Second)
		fmt.Println("publish failed, retrying.")
		Publish(routingKey, msgString)
	}
	return
}

func ProcessBuffer(c <-chan m.MetricDefinition) {
	buf := make(map[uint32][]m.MetricDefinition)

	// flush buffer 10 times every second
	t := time.NewTicker(time.Millisecond * 100)
	for {
		select {
		case b := <-c:
			if b.OrgId != 0 {
				//get hash.
				hash := uint32(1)
				if _, ok := buf[hash]; !ok {
					buf[hash] = make([]m.MetricDefinition, 0)
				}
				buf[hash] = append(buf[hash], b)
			}
		case <-t.C:
			//copy contents of buffer
			for hash, metrics := range buf {
				currentBuf := make([]m.MetricDefinition, len(metrics))
				copy(currentBuf, metrics)
				delete(buf, hash)
				//log.Info(fmt.Sprintf("flushing %d items in buffer now", len(currentBuf)))
				msgString, err := json.Marshal(currentBuf)
				if err != nil {
					log.Error(0, "Failed to marshal metrics payload.", err)
				} else {
					go Publish(fmt.Sprintf("%d", hash), msgString)
				}
			}
		}
	}
}
