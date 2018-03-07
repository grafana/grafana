package mqe

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func NewQueryParser() *QueryParser {
	return &QueryParser{}
}

type QueryParser struct{}

func (qp *QueryParser) Parse(model *simplejson.Json, dsInfo *models.DataSource, queryContext *tsdb.QueryContext) (*Query, error) {
	query := &Query{TimeRange: queryContext.TimeRange}
	query.AddClusterToAlias = model.Get("addClusterToAlias").MustBool(false)
	query.AddHostToAlias = model.Get("addHostToAlias").MustBool(false)
	query.UseRawQuery = model.Get("rawQuery").MustBool(false)
	query.RawQuery = model.Get("query").MustString("")

	query.Cluster = model.Get("cluster").MustStringArray([]string{})
	query.Hosts = model.Get("hosts").MustStringArray([]string{})

	var metrics []Metric
	var err error
	for _, metricsObj := range model.Get("metrics").MustArray() {
		metricJson := simplejson.NewFromAny(metricsObj)
		var m Metric

		m.Alias = metricJson.Get("alias").MustString("")
		m.Metric, err = metricJson.Get("metric").String()
		if err != nil {
			return nil, err
		}

		metrics = append(metrics, m)
	}

	query.Metrics = metrics

	var functions []Function
	for _, functionListObj := range model.Get("functionList").MustArray() {
		functionListJson := simplejson.NewFromAny(functionListObj)
		var f Function

		f.Func = functionListJson.Get("func").MustString("")
		if err != nil {
			return nil, err
		}

		if f.Func != "" {
			functions = append(functions, f)
		}
	}

	query.FunctionList = functions

	return query, nil
}
