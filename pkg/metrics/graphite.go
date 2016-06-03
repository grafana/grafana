package metrics

import (
	"bytes"
	"fmt"
	"net"
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
	addToBuf := func(metric string, value int64) {
		buf.WriteString(fmt.Sprintf("%s %d %d\n", metric, value, now))
	}

	for _, m := range metrics {
		metricName := this.Prefix + m.Name() + m.StringifyTags()
		log.Info(metricName)

		switch metric := m.(type) {
		case Counter:
			addToBuf(metricName+".count", metric.Count())
		case Timer:
			addToBuf(metricName+".count", metric.Count())
			addToBuf(metricName+".max", metric.Max())
			addToBuf(metricName+".min", metric.Min())
			addToBuf(metricName+".avg", metric.Avg())
		}
	}

	log.Trace("Metrics: GraphitePublisher.Publish() \n%s", buf)
	_, err = conn.Write(buf.Bytes())

	if err != nil {
		log.Error(3, "Metrics: GraphitePublisher: Failed to send metrics! %s", err)
	}
}
