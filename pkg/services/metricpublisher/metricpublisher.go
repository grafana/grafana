package metricpublisher

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	met "github.com/grafana/grafana/pkg/metric"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rabbitmq"
	"github.com/grafana/grafana/pkg/setting"
	"hash/crc32"
	"time"
)

var (
	globalPublisher        *rabbitmq.Publisher
	metricPublisherMetrics met.Count
	metricPublisherMsgs    met.Count
)

func Init(metrics met.Backend) {
	sec := setting.Cfg.Section("event_publisher")

	if !sec.Key("enabled").MustBool(false) {
		return
	}

	url := sec.Key("rabbitmq_url").String()
	exchange := "metricResults"

	exch := rabbitmq.Exchange{
		Name:         exchange,
		ExchangeType: "x-consistent-hash",
		Durable:      true,
	}
	globalPublisher = &rabbitmq.Publisher{Url: url, Exchange: &exch}
	err := globalPublisher.Connect()
	if err != nil {
		log.Fatal(4, "Failed to connect to metricResults exchange: %v", err)
		return
	}
	metricPublisherMetrics = metrics.NewCount("metricpublisher.metrics-published")
	metricPublisherMsgs = metrics.NewCount("metricpublisher.messages-published")
}

func Publish(routingKey string, msgString []byte) {
	if globalPublisher != nil {
		globalPublisher.Publish(routingKey, msgString)
	}
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
				h := crc32.NewIEEE()
				h.Write([]byte(b.Name))
				hash := h.Sum32() % uint32(512)
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
					metricPublisherMetrics.Inc(int64(len(currentBuf)))
					metricPublisherMsgs.Inc(1)
					go Publish(fmt.Sprintf("%d", hash), msgString)
				}
			}
		}
	}
}
