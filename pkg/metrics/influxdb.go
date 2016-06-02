package metrics

import (
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/influxdata/influxdb/client"
)

type InfluxPublisher struct {
	database string
	tags     map[string]string
	prefix   string
	client   *client.Client
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
		point := client.Point{
			Measurement: this.prefix + m.Name(),
			Tags:        m.Tags(),
		}

		switch metric := m.(type) {
		case Counter:
			if metric.Count() > 0 {
				point.Fields = map[string]interface{}{"value": metric.Count()}
				bp.Points = append(bp.Points, point)
			}
		}
	}

	_, err := this.client.Write(bp)
	if err != nil {
		log.Error(3, "Metrics: InfluxPublisher: publish error", err)
	}
}
