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
	//go stresser() // enable this to send a "stress load" to test the metrics pipeline
}

func stresser() {
	// we rather lag behind then dropping ticks
	// so that when we graph the metrics timeseries or analyze messages sent, there are no gaps
	// we much rather just have the series end a bit sooner, which is trivial to spot.
	syncTicks := time.Tick(time.Duration(1) * time.Second)
	asyncTicks := make(chan time.Time, 1000)
	go func() {
		for t := range syncTicks {
			asyncTicks <- t
		}
	}()

	layout := "test-metric.Jan-02.15.04.05"
	start := time.Now().Add(-time.Duration(1000) * time.Second)
	for t := range asyncTicks {
		pre := time.Now()
		metrics := make([]*m.MetricDefinition, 0)
		var val time.Time
		for val = start; !val.After(t); val = val.Add(time.Second) {
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
				Tags: map[string]string{
					"foo_id": "15",
				},
			}
			metrics = append(metrics, metric)
		}
		log.Info("stresser: publishing %d metrics for time %s", len(metrics), val)
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
		metricsPublished.Inc(int64(len(subslice)))
		messagesPublished.Inc(1)
		messagesSize.Value(int64(buf.Len()))
		metricsPerMessage.Value(int64(len(subslice)))
		pre := time.Now()
		err = globalProducer.Publish(topic, buf.Bytes())
		publishDuration.Value(time.Since(pre))
		if err != nil {
			log.Fatal(0, "can't publish to nsqd: %s", err)
		}
		log.Info("published metrics %d size=%d", id, buf.Len())
	}

	//globalProducer.Stop()
	return nil
}
