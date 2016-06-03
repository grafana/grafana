package metrics

import (
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/influxdata/influxdb/client"
)

type InfluxPublisher struct {
	database   string
	tags       map[string]string
	prefix     string
	client     *client.Client
	prevCounts map[string]int64
}

func CreateInfluxPublisher() (*InfluxPublisher, error) {
	influxSection, err := setting.Cfg.GetSection("metrics.influxdb")
	if err != nil {
		return nil, nil
	}

	publisher := &InfluxPublisher{
		tags: make(map[string]string),
	}

	urlStr := influxSection.Key("url").MustString("localhost:2003")
	urlParsed, err := url.Parse(urlStr)

	if err != nil {
		log.Error(3, "Metics: InfluxPublisher: failed to init influxdb publisher", err)
		return nil, nil
	}

	publisher.database = influxSection.Key("database").MustString("grafana_metrics")
	publisher.prefix = influxSection.Key("prefix").MustString("prefix")
	publisher.prevCounts = make(map[string]int64)

	username := influxSection.Key("User").MustString("grafana")
	password := influxSection.Key("Password").MustString("grafana")

	publisher.client, err = client.NewClient(client.Config{
		URL:      *urlParsed,
		Username: username,
		Password: password,
	})

	tagsSec, err := setting.Cfg.GetSection("metrics.influxdb.tags")
	if err != nil {
		log.Error(3, "Metics: InfluxPublisher: failed to init influxdb settings no metrics.influxdb.tags section")
		return nil, nil
	}

	for _, key := range tagsSec.Keys() {
		publisher.tags[key.Name()] = key.String()
	}

	if err != nil {
		log.Error(3, "Metics: InfluxPublisher: failed to init influxdb publisher", err)
	}

	return publisher, nil
}

func (this *InfluxPublisher) Publish(metrics []Metric) {
	bp := client.BatchPoints{
		Time:     time.Now(),
		Database: this.database,
		Tags:     map[string]string{},
	}

	for key, value := range this.tags {
		bp.Tags[key] = value
	}

	for _, m := range metrics {
		switch metric := m.(type) {
		case Counter:
			this.addPoint(&bp, metric, "count", metric.Count())
		case Timer:
			percentiles := metric.Percentiles([]float64{0.25, 0.75, 0.90, 0.99})
			this.addPoint(&bp, metric, "count", metric.Count())
			this.addPoint(&bp, metric, "min", metric.Min())
			this.addPoint(&bp, metric, "max", metric.Max())
			this.addPoint(&bp, metric, "mean", metric.Mean())
			this.addPoint(&bp, metric, "std", metric.StdDev())
			this.addPoint(&bp, metric, "p25", percentiles[0])
			this.addPoint(&bp, metric, "p75", percentiles[1])
			this.addPoint(&bp, metric, "p90", percentiles[2])
			this.addPoint(&bp, metric, "p99", percentiles[2])
		}
	}

	_, err := this.client.Write(bp)
	if err != nil {
		log.Error(3, "Metrics: InfluxPublisher: publish error", err)
	}
}

func (this *InfluxPublisher) addPoint(bp *client.BatchPoints, metric Metric, metricTag string, value interface{}) {
	tags := metric.GetTagsCopy()
	tags["metric"] = metricTag

	bp.Points = append(bp.Points, client.Point{
		Measurement: metric.Name(),
		Tags:        tags,
		Fields:      map[string]interface{}{"value": value},
	})
}

func (this *InfluxPublisher) addCountPoint(bp *client.BatchPoints, metric Metric, value int64) {
	tags := metric.GetTagsCopy()
	tags["metric"] = "count"

	name := metric.Name()
	delta := value
	if last, ok := this.prevCounts[name]; ok {
		delta = calculateDelta(last, value)
	}
	this.prevCounts[name] = value

	bp.Points = append(bp.Points, client.Point{
		Measurement: name,
		Tags:        tags,
		Fields:      map[string]interface{}{"value": delta},
	})
}
