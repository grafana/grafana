package collectoreventpublisher

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"time"

	"github.com/bitly/go-nsq"
	"github.com/grafana/grafana/pkg/log"
	met "github.com/grafana/grafana/pkg/metric"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// identifier of message format
const (
	msgFormatJson = iota
)

var (
	globalProducer              *nsq.Producer
	topic                       string
	collectorEventPublisherMsgs met.Count
	enabled                     bool
)

func Init(metrics met.Backend) {
	sec := setting.Cfg.Section("collector_event_publisher")

	if !sec.Key("enabled").MustBool(false) {
		enabled = false
		return
	}
	enabled = true

	addr := sec.Key("nsqd_addr").MustString("localhost:4150")
	topic = sec.Key("topic").MustString("metrics")
	cfg := nsq.NewConfig()
	cfg.UserAgent = fmt.Sprintf("probe-ctrl")
	var err error
	globalProducer, err = nsq.NewProducer(addr, cfg)
	if err != nil {
		log.Fatal(0, "failed to initialize nsq producer.", err)
	}
	collectorEventPublisherMsgs = metrics.NewCount("collectoreventpublisher.events-published")
	//go stresser() // enable this to send a "stress load" to test the metrics pipeline
}

func Publish(event *m.CollectorEventDefinition) error {
	if !enabled {
		return nil
	}
	version := uint8(msgFormatJson)

	buf := new(bytes.Buffer)
	err := binary.Write(buf, binary.LittleEndian, version)
	if err != nil {
		log.Fatal(0, "binary.Write failed: %s", err.Error())
	}
	id := time.Now().UnixNano()
	binary.Write(buf, binary.BigEndian, id)
	if err != nil {
		log.Fatal(0, "binary.Write failed: %s", err.Error())
	}
	msg, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("Failed to marshal event payload: %s", err)
	}
	_, err = buf.Write(msg)
	if err != nil {
		log.Fatal(0, "buf.Write failed: %s", err.Error())
	}
	collectorEventPublisherMsgs.Inc(1)
	err = globalProducer.Publish(topic, buf.Bytes())
	if err != nil {
		panic(fmt.Errorf("can't publish to nsqd: %s", err))
	}
	log.Info("event published to NSQ %d", id)

	//globalProducer.Stop()
	return nil
}
