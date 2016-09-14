package metrics

import (
	"bytes"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

type GraphitePublisher struct {
	address    string
	protocol   string
	prefix     string
	prevCounts map[string]int64
}

func CreateGraphitePublisher() (*GraphitePublisher, error) {
	graphiteSection, err := setting.Cfg.GetSection("metrics.graphite")
	if err != nil {
		return nil, nil
	}

	address := graphiteSection.Key("address").String()
	if address == "" {
		return nil, nil
	}

	publisher := &GraphitePublisher{}
	publisher.prevCounts = make(map[string]int64)
	publisher.protocol = "tcp"
	publisher.prefix = graphiteSection.Key("prefix").MustString("prod.grafana.%(instance_name)s")
	publisher.address = address

	safeInstanceName := strings.Replace(setting.InstanceName, ".", "_", -1)
	prefix := graphiteSection.Key("prefix").Value()

	if prefix == "" {
		prefix = "prod.grafana.%(instance_name)s."
	}

	publisher.prefix = strings.Replace(prefix, "%(instance_name)s", safeInstanceName, -1)
	return publisher, nil
}

func (this *GraphitePublisher) Publish(metrics []Metric) {
	conn, err := net.DialTimeout(this.protocol, this.address, time.Second*5)

	if err != nil {
		log.Error(3, "Metrics: GraphitePublisher:  Failed to connect to %s!", err)
		return
	}

	buf := bytes.NewBufferString("")
	now := time.Now().Unix()

	for _, m := range metrics {
		metricName := this.prefix + m.Name() + m.StringifyTags()

		switch metric := m.(type) {
		case Counter:
			this.addCount(buf, metricName+".count", metric.Count(), now)
		case Timer:
			percentiles := metric.Percentiles([]float64{0.25, 0.75, 0.90, 0.99})
			this.addCount(buf, metricName+".count", metric.Count(), now)
			this.addInt(buf, metricName+".max", metric.Max(), now)
			this.addInt(buf, metricName+".min", metric.Min(), now)
			this.addFloat(buf, metricName+".mean", metric.Mean(), now)
			this.addFloat(buf, metricName+".std", metric.StdDev(), now)
			this.addFloat(buf, metricName+".p25", percentiles[0], now)
			this.addFloat(buf, metricName+".p75", percentiles[1], now)
			this.addFloat(buf, metricName+".p90", percentiles[2], now)
			this.addFloat(buf, metricName+".p99", percentiles[3], now)
		}
	}

	log.Trace("Metrics: GraphitePublisher.Publish() \n%s", buf)
	_, err = conn.Write(buf.Bytes())

	if err != nil {
		log.Error(3, "Metrics: GraphitePublisher: Failed to send metrics! %s", err)
	}
}

func (this *GraphitePublisher) addInt(buf *bytes.Buffer, metric string, value int64, now int64) {
	buf.WriteString(fmt.Sprintf("%s %d %d\n", metric, value, now))
}

func (this *GraphitePublisher) addFloat(buf *bytes.Buffer, metric string, value float64, now int64) {
	buf.WriteString(fmt.Sprintf("%s %f %d\n", metric, value, now))
}

func (this *GraphitePublisher) addCount(buf *bytes.Buffer, metric string, value int64, now int64) {
	delta := value

	if last, ok := this.prevCounts[metric]; ok {
		delta = calculateDelta(last, value)
	}

	this.prevCounts[metric] = value
	buf.WriteString(fmt.Sprintf("%s %d %d\n", metric, delta, now))
}
