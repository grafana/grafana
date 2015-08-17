package metricpublisher

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
	msgFormatMetricDefinitionArrayJson = iota
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
	//go stresser() // enable this to send a "stress load" to test the metrics pipeline
}

func stresser() {
	layout := "test-metric.Jan-02.15.04.05"
	start := time.Now().Add(-time.Duration(1000) * time.Second)
	tick := time.Tick(time.Duration(1) * time.Second)
	for t := range tick {
		pre := time.Now()
		metrics := make([]*m.MetricDefinition, 0)
		for val := start; !val.After(t); val = val.Add(time.Second) {
			key := val.Format(layout)
			metric := &m.MetricDefinition{
				OrgId:      1,
				Name:       "foo_15." + key,
				Metric:     key,
				Interval:   1,
				Value:      float64(t.Unix()),
				Unit:       "s",
				Time:       t.Unix(),
				TargetType: "gauge",
				Tags: map[string]interface{}{
					"foo_id": 15,
				},
			}
			metrics = append(metrics, metric)
		}
		log.Info("stresser: publishing %d metrics", len(metrics))
		Publish(metrics)
		log.Info("stresser: loop duration %s", time.Now().Sub(pre))
	}
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

	version := uint8(msgFormatMetricDefinitionArrayJson)

	for _, subslice := range subslices {
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
		msg, err := json.Marshal(subslice)
		if err != nil {
			return fmt.Errorf("Failed to marshal metrics payload: %s", err)
		}
		_, err = buf.Write(msg)
		if err != nil {
			log.Fatal(0, "buf.Write failed: %s", err.Error())
		}
		metricPublisherMetrics.Inc(int64(len(subslice)))
		metricPublisherMsgs.Inc(1)
		err = globalProducer.Publish(topic, buf.Bytes())
		if err != nil {
			panic(fmt.Errorf("can't publish to nsqd: %s", err))
		}
		log.Info("DIETERPUBLISHED %d", id)
	}

	//globalProducer.Stop()
	return nil
}
