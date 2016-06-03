package metrics

import (
	"bytes"
	"fmt"
	"net"
	"reflect"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

type GraphitePublisher struct {
	Address  string
	Protocol string
	Prefix   string
}

func CreateGraphitePublisher() (*GraphitePublisher, error) {
	graphiteSection, err := setting.Cfg.GetSection("metrics.graphite")
	if err != nil {
		return nil, nil
	}

	publisher := &GraphitePublisher{}
	publisher.Protocol = "tcp"
	publisher.Address = graphiteSection.Key("address").MustString("localhost:2003")
	publisher.Prefix = graphiteSection.Key("prefix").MustString("service.grafana.%(instance_name)s")

	return publisher, nil
}

func (this *GraphitePublisher) Publish(metrics []Metric) {
	conn, err := net.DialTimeout(this.Protocol, this.Address, time.Second*5)

	if err != nil {
		log.Error(3, "Metrics: GraphitePublisher:  Failed to connect to %s!", err)
		return
	}

	buf := bytes.NewBufferString("")
	now := time.Now().Unix()
	addIntToBuf := func(metric string, value int64) {
		buf.WriteString(fmt.Sprintf("%s %d %d\n", metric, value, now))
	}
	addFloatToBuf := func(metric string, value float64) {
		buf.WriteString(fmt.Sprintf("%s %f %d\n", metric, value, now))
	}

	for _, m := range metrics {
		log.Info("metric: %v, %v", m, reflect.TypeOf(m))
		metricName := this.Prefix + m.Name() + m.StringifyTags()

		switch metric := m.(type) {
		case Counter:
			addIntToBuf(metricName+".count", metric.Count())
		case SimpleTimer:
			addIntToBuf(metricName+".count", metric.Count())
			addIntToBuf(metricName+".max", metric.Max())
			addIntToBuf(metricName+".min", metric.Min())
			addFloatToBuf(metricName+".mean", metric.Mean())
		case Timer:
			percentiles := metric.Percentiles([]float64{0.25, 0.75, 0.90, 0.99})
			addIntToBuf(metricName+".count", metric.Count())
			addIntToBuf(metricName+".max", metric.Max())
			addIntToBuf(metricName+".min", metric.Min())
			addFloatToBuf(metricName+".mean", metric.Mean())
			addFloatToBuf(metricName+".std", metric.StdDev())
			addFloatToBuf(metricName+".p25", percentiles[0])
			addFloatToBuf(metricName+".p75", percentiles[1])
			addFloatToBuf(metricName+".p90", percentiles[2])
			addFloatToBuf(metricName+".p99", percentiles[3])
		}

	}

	log.Trace("Metrics: GraphitePublisher.Publish() \n%s", buf)
	_, err = conn.Write(buf.Bytes())

	if err != nil {
		log.Error(3, "Metrics: GraphitePublisher: Failed to send metrics! %s", err)
	}
}
