package metricpublisher

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/bitly/go-nsq"
	"github.com/grafana/grafana/pkg/log"
	met "github.com/grafana/grafana/pkg/metric"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	globalProducer         *nsq.Producer
	topic                  string
	metricPublisherMetrics met.Count
	metricPublisherMsgs    met.Count
)

func Init(metrics met.Backend) {
	sec := setting.Cfg.Section("metric_publisher")

	if !sec.Key("enabled").MustBool(false) {
		return
	}

	addr := sec.Key("nsqd_addr").MustString("localhost:4150")
	topic = sec.Key("topic").MustString("metrics")
	cfg := nsq.NewConfig()
	var err error
	globalProducer, err = nsq.NewProducer(addr, cfg)
	if err != nil {
		log.Fatal(0, "failed to initialize nsq producer.", err)
	}
	metricPublisherMetrics = metrics.NewCount("metricpublisher.metrics-published")
	metricPublisherMsgs = metrics.NewCount("metricpublisher.messages-published")
}

func ProcessBuffer(c <-chan m.MetricDefinition) {
	cfg := nsq.NewConfig()
	cfg.UserAgent = fmt.Sprintf("probe-ctrl")

	// TODO: configurable nsqd address
	producer, err := nsq.NewProducer("nsqd:4150", cfg)
	if err != nil {
		log.Fatal(0, "Failed to start producer: %q", err)
	}

	maxMpubSize := 5 * 1024 * 1024 // nsq errors if more. not sure if can be changed
	maxMetricPerMsg := 1000        // emperically found through benchmarks (should result in 64~128k messages)

	msgs := make([][]byte, 0)
	msgsSize := 0
	msg := make([]m.MetricDefinition, 0)

	flushTicker := time.NewTicker(time.Millisecond * 100)

	flush := func(msgs [][]byte) {
		if len(msgs) == 0 {
			return
		}
		metricPublisherMetrics.Inc(int64(len(msgs)))
		metricPublisherMsgs.Inc(1)
		go func() {
			err := producer.MultiPublish("metricDefs", msgs)
			if err != nil {
				log.Error(0, "can't publish to nsqd: %s", err)
			}
		}()
	}
	for {
		select {
		case b := <-c:
			if b.OrgId == 0 {
				continue
			}
			msg = append(msg, b)
			if len(msg) == maxMetricPerMsg {
				msgString, err := json.Marshal(msg)
				if err != nil {
					log.Error(0, "Failed to marshal metrics payload.", err)
				} else {
					msgs = append(msgs, msgString)
					msgsSize += len(msgString)
					if msgsSize > (80/100)*maxMpubSize {
						flush(msgs)
						msgs = make([][]byte, 0)
						msgsSize = 0
					}
				}
				msg = make([]m.MetricDefinition, 0)
			}
		case <-flushTicker.C:
			if len(msg) != 0 {
				msgString, err := json.Marshal(msg)
				if err != nil {
					log.Error(0, "Failed to marshal metrics payload.", err)
				} else {
					msgs = append(msgs, msgString)
				}
			}
			flush(msgs)
			msgs = make([][]byte, 0)
			msgsSize = 0
			msg = make([]m.MetricDefinition, 0)
		}
	}
	//producer.Stop()
}
