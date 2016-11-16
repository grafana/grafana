package mqe

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MQEQueryParser struct{}

func (qp *MQEQueryParser) Parse(model *simplejson.Json, dsInfo *tsdb.DataSourceInfo, queryContext *tsdb.QueryContext) (*MQEQuery, error) {
	query := &MQEQuery{TimeRange: queryContext.TimeRange}
	query.AddAppToAlias = model.Get("addAppToAlias").MustBool(false)
	query.AddHostToAlias = model.Get("addHostToAlias").MustBool(false)
	query.UseRawQuery = model.Get("rawQuery").MustBool(false)
	query.RawQuery = model.Get("query").MustString("")

	query.Apps = model.Get("apps").MustStringArray([]string{})
	query.Hosts = model.Get("hosts").MustStringArray([]string{})

	var metrics []MQEMetric
	var err error
	for _, metricsObj := range model.Get("metrics").MustArray() {
		metricJson := simplejson.NewFromAny(metricsObj)
		var m MQEMetric

		m.Alias = metricJson.Get("alias").MustString("")
		m.Metric, err = metricJson.Get("metric").String()
		if err != nil {
			return nil, err
		}

		metrics = append(metrics, m)
	}

	query.Metrics = metrics

	return query, nil
}
