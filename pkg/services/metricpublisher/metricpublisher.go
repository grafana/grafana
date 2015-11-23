package metricpublisher

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/log"
	met "github.com/grafana/grafana/pkg/metric"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/nsqio/go-nsq"
	msg "github.com/raintank/raintank-metric/msg"
	"github.com/raintank/raintank-metric/schema"
)

const maxMpubSize = 5 * 1024 * 1024 // nsq errors if more. not sure if can be changed
const maxMetricPerMsg = 1000        // emperically found through benchmarks (should result in 64~128k messages)
var (
	globalProducer    *nsq.Producer
	topic             string
	metricsPublished  met.Count
	messagesPublished met.Count
	messagesSize      met.Meter
	metricsPerMessage met.Meter
	publishDuration   met.Timer
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
	err = globalProducer.Ping()
	if err != nil {
		log.Fatal(0, "can't connect to nsqd: %s", err)
	}
	metricsPublished = metrics.NewCount("metricpublisher.metrics-published")
	messagesPublished = metrics.NewCount("metricpublisher.messages-published")
	messagesSize = metrics.NewMeter("metricpublisher.message_size", 0)
	metricsPerMessage = metrics.NewMeter("metricpublisher.metrics_per_message", 0)
	publishDuration = metrics.NewTimer("metricpublisher.publish_duration", 0)
}

func Reslice(in []*schema.MetricData, size int) [][]*schema.MetricData {
	numSubSlices := len(in) / size
	if len(in)%size > 0 {
		numSubSlices += 1
	}
	out := make([][]*schema.MetricData, numSubSlices)
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

func Publish(metrics []*schema.MetricData) error {
	if globalProducer == nil {
		return nil
	}
	if len(metrics) == 0 {
		return nil
	}
	// typical metrics seem to be around 300B
	// nsqd allows <= 10MiB messages.
	// we ideally have 64kB ~ 1MiB messages (see benchmark https://gist.github.com/Dieterbe/604232d35494eae73f15)
	// at 300B, about 3500 msg fit in 1MiB
	// in worst case, this allows messages up to 2871B
	// this could be made more robust of course

	// real world findings in dev-stack with env-load:
	// 159569B msg /795  metrics per msg = 200B per msg
	// so peak message size is about 3500*200 = 700k (seen 711k)

	subslices := Reslice(metrics, 3500)

	for _, subslice := range subslices {
		id := time.Now().UnixNano()
		data, err := msg.CreateMsg(subslice, id, msg.FormatMetricDataArrayMsgp)
		if err != nil {
			log.Fatal(0, "Fatal error creating metric message: %s", err)
		}
		metricsPublished.Inc(int64(len(subslice)))
		messagesPublished.Inc(1)
		messagesSize.Value(int64(len(data)))
		metricsPerMessage.Value(int64(len(subslice)))
		pre := time.Now()
		err = globalProducer.Publish(topic, data)
		publishDuration.Value(time.Since(pre))
		if err != nil {
			log.Fatal(0, "can't publish to nsqd: %s", err)
		}
		log.Info("published metrics %d size=%d", id, len(data))
	}

	//globalProducer.Stop()
	return nil
}
