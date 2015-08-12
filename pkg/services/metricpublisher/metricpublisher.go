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

func Reslice(in []*m.MetricDefinition, size int) [][]*m.MetricDefinition {
	numSubSlices := len(in) / size
	if len(in)%size > 0 {
		numSubSlices += 1
	}
	out := make([][]*m.MetricDefinition, numSubSlices)
	for i := 0; i < numSubSlices; i++ {
		start := i * size
		end := (i + 1) * size
		if end > len(in) {
			out[i] = in[start:]
		} else {
			out[i] = in[start:end]
		}
	}
	return out
}

func Publish(metrics []*m.MetricDefinition) error {
	if len(metrics) == 0 {
		return nil
	}
	// TODO instrument len(metrics), msg size, set alerts
	// TODO if we panic, make sure no auto-restart until nsqd is up. make probe retry if grafana panics

	// typical metrics seem to be around 300B
	// nsqd allows <= 10MiB messages.
	// we ideally have 64kB ~ 1MiB messages (see benchmark https://gist.github.com/Dieterbe/604232d35494eae73f15)
	// at 300B, about 3500 msg fit in 1MiB
	// in worst case, this allows messages up to 2871B
	// this could be made more robust of course

	subslices := Reslice(metrics, 3500)
	for _, subslice := range subslices {
		msg, err := json.Marshal(subslice)
		if err != nil {
			return fmt.Errorf("Failed to marshal metrics payload: %s", err)
		}
		metricPublisherMetrics.Inc(int64(len(subslice)))
		metricPublisherMsgs.Inc(1)
		err = globalProducer.Publish(topic, msg)
		if err != nil {
			panic(fmt.Errorf("can't publish to nsqd: %s", err))
		}
	}

	//globalProducer.Stop()
	return nil
}
