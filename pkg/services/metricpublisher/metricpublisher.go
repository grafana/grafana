package metricpublisher

import (
	"encoding/json"
	"fmt"

	"github.com/bitly/go-nsq"
	"github.com/grafana/grafana/pkg/log"
	met "github.com/grafana/grafana/pkg/metric"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

const maxMpubSize = 5 * 1024 * 1024 // nsq errors if more. not sure if can be changed
const maxMetricPerMsg = 1000        // emperically found through benchmarks (should result in 64~128k messages)
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
	cfg.UserAgent = fmt.Sprintf("probe-ctrl")
	var err error
	globalProducer, err = nsq.NewProducer(addr, cfg)
	if err != nil {
		log.Fatal(0, "failed to initialize nsq producer.", err)
	}
	metricPublisherMetrics = metrics.NewCount("metricpublisher.metrics-published")
	metricPublisherMsgs = metrics.NewCount("metricpublisher.messages-published")
}

func Publish(metrics []*m.MetricDefinition) error {
	if len(metrics) == 0 {
		return nil
	}
	// TODO handle metrics too big to fit into single nsq packet
	// TODO instrument len(metrics), msg size

	msg, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("Failed to marshal metrics payload: %s", err)
	}
	metricPublisherMetrics.Inc(int64(len(metrics)))
	metricPublisherMsgs.Inc(1)
	go func() {
		err := globalProducer.Publish(topic, msg)
		if err != nil {
			log.Error(0, "can't publish to nsqd: %s", err)
		}
	}()
	//globalProducer.Stop()
	return nil
}
