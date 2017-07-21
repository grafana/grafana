package es5

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/bmizerany/assert"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"gopkg.in/olivere/elastic.v5"
)

func TestCountMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeCount)
	parser, succ := p.(*countMetricParser)
	if !succ {
		t.Error("type error")
	}
	json, err := simplejson.NewJson([]byte(`{"id":"1", "type":"count"}`))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(json)
	if err != nil {
		t.Error(err)
	}
	assert.Equal(t, a, nil)
}

func TestAvgMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeAvg)
	parser, succ := p.(*avgMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":{},"settings":{"script":{"inline":"_value * 10"}},"type":"avg"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.AvgAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.AvgAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"avg"`))
}

func TestSumMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeSum)
	parser, succ := p.(*sumMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":{},"settings":{"script":{"inline":"_value * 10"}},"type":"sum"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.SumAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.SumAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"sum"`))
}

func TestMinMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeMin)
	parser, succ := p.(*minMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":{},"settings":{"script":{"inline":"_value * 10"}},"type":"min"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.MinAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.MinAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"min"`))
}

func TestMaxMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeMax)
	parser, succ := p.(*maxMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":{},"settings":{"script":{"inline":"_value * 10"}},"type":"max"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.MaxAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.MaxAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"max"`))
}

func TestStatsMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeExtendedStats)
	parser, succ := p.(*statsMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":` +
		`{"avg":true,"count":true,"max":true,"min":true,"std_deviation":true,"std_deviation_bounds_lower":true,` +
		`"std_deviation_bounds_upper":true,"sum":true},"settings":{"script":{"inline":"_value * 10"}},"type":"extended_stats"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.ExtendedStatsAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.ExtendedStatsAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"extended_stats"`))
}

func TestPercentilesMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypePercentiles)
	parser, succ := p.(*percentileMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":{},"settings":{"percents":[25,50,75,95,99],"script":{"inline":"_value * 10"}},"type":"percentiles"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.PercentilesAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.PercentilesAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"percents":[25,50,75,95,99]`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"percentiles"`))
}

func TestCardinalityMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeCardinality)
	parser, succ := p.(*cardinalityMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"body_bytes_sent","id":"1","inlineScript":"_value * 10","meta":{},"settings":{"precision_threshold":10},"type":"cardinality"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.CardinalityAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.CardinalityAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"script":{"inline":"_value * 10"}`))
	assert.T(t, strings.Contains(string(srcStr), `"precision_threshold":10`))
	assert.T(t, strings.Contains(string(srcStr), `"field":"body_bytes_sent"`))
	assert.T(t, strings.Contains(string(srcStr), `"cardinality"`))
}

func TestMovAggMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeMovAvg)
	parser, succ := p.(*movingAvgMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"3","id":"1","inlineScript":"_value * 10","meta":{},"pipelineAgg":"3","settings":{"minimize":false,"model":"simple","predict":1,"window":5},"type":"moving_avg"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.MovAvgAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.MovAvgAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"buckets_path":"3"`))
	assert.T(t, strings.Contains(string(srcStr), `"minimize":false`))
	assert.T(t, strings.Contains(string(srcStr), `"model":"simple"`))
	assert.T(t, strings.Contains(string(srcStr), `"predict":1`))
	assert.T(t, strings.Contains(string(srcStr), `"window":5`))
	assert.T(t, strings.Contains(string(srcStr), `"moving_avg"`))

	data = `{"field":"3","id":"1","inlineScript":"_value * 10","meta":{},"pipelineAgg":"3","settings":{"minimize":false,"model":"linear","predict":1,"window":5},"type":"moving_avg"}`
	jsonData, err = simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err = parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, _ = a.(*elastic.MovAvgAggregation)
	src, err = agg.Source()
	srcStr, err = json.Marshal(src)
	assert.T(t, strings.Contains(string(srcStr), `"buckets_path":"3"`))
	assert.T(t, strings.Contains(string(srcStr), `"minimize":false`))
	assert.T(t, strings.Contains(string(srcStr), `"model":"linear"`))
	assert.T(t, strings.Contains(string(srcStr), `"predict":1`))
	assert.T(t, strings.Contains(string(srcStr), `"window":5`))
	assert.T(t, strings.Contains(string(srcStr), `"moving_avg"`))

	data = `{"field":"3","id":"1","inlineScript":"_value * 10","meta":{},"pipelineAgg":"3","settings":{"minimize":true,"model":"ewma","predict":1,"settings":{"alpha":1},"window":5},"type":"moving_avg"}`
	jsonData, err = simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err = parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, _ = a.(*elastic.MovAvgAggregation)
	src, err = agg.Source()
	srcStr, err = json.Marshal(src)
	assert.T(t, strings.Contains(string(srcStr), `"buckets_path":"3"`))
	assert.T(t, strings.Contains(string(srcStr), `"minimize":true`))
	assert.T(t, strings.Contains(string(srcStr), `"model":"ewma"`))
	assert.T(t, strings.Contains(string(srcStr), `"predict":1`))
	assert.T(t, strings.Contains(string(srcStr), `"window":5`))
	assert.T(t, strings.Contains(string(srcStr), `"moving_avg"`))
	assert.T(t, strings.Contains(string(srcStr), `"alpha":1`))

	data = `{"field":"3","id":"1","inlineScript":"_value * 10","meta":{},"pipelineAgg":"3","settings":{"minimize":true,"model":"holt","predict":1,"settings":{"alpha":1,"beta":1},"window":5},"type":"moving_avg"}`
	jsonData, err = simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err = parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, _ = a.(*elastic.MovAvgAggregation)
	src, err = agg.Source()
	srcStr, err = json.Marshal(src)
	assert.T(t, strings.Contains(string(srcStr), `"buckets_path":"3"`))
	assert.T(t, strings.Contains(string(srcStr), `"minimize":true`))
	assert.T(t, strings.Contains(string(srcStr), `"model":"holt"`))
	assert.T(t, strings.Contains(string(srcStr), `"predict":1`))
	assert.T(t, strings.Contains(string(srcStr), `"window":5`))
	assert.T(t, strings.Contains(string(srcStr), `"moving_avg"`))
	assert.T(t, strings.Contains(string(srcStr), `"alpha":1`))
	assert.T(t, strings.Contains(string(srcStr), `"beta":1`))

	data = `{"field":"3","id":"1","inlineScript":"_value * 10","meta":{},"pipelineAgg":"3","settings":{"minimize":true,"model":"holt_winters","predict":1,"settings":{"alpha":1,"beta":1,"gamma":1,"pad":true,"period":1},"window":5},"type":"moving_avg"}`
	jsonData, err = simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err = parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, _ = a.(*elastic.MovAvgAggregation)
	src, err = agg.Source()
	srcStr, err = json.Marshal(src)
	assert.T(t, strings.Contains(string(srcStr), `"buckets_path":"3"`))
	assert.T(t, strings.Contains(string(srcStr), `"minimize":true`))
	assert.T(t, strings.Contains(string(srcStr), `"model":"holt_winters"`))
	assert.T(t, strings.Contains(string(srcStr), `"predict":1`))
	assert.T(t, strings.Contains(string(srcStr), `"window":5`))
	assert.T(t, strings.Contains(string(srcStr), `"moving_avg"`))
	assert.T(t, strings.Contains(string(srcStr), `"gamma":1`))
	assert.T(t, strings.Contains(string(srcStr), `"pad":true,`))
	assert.T(t, strings.Contains(string(srcStr), `"period":1`))
}

func TestDerivativeMetricParser_Parse(t *testing.T) {
	p := GetMetricParser(models.AggTypeDerivative)
	parser, succ := p.(*derivativeMetricParser)
	if !succ {
		t.Error("type error")
	}
	data := `{"field":"3","id":"1","inlineScript":"_value * 10","meta":{},"pipelineAgg":"3","settings":{"unit":"10s"},"type":"derivative"}`
	jsonData, err := simplejson.NewJson([]byte(data))
	if err != nil {
		t.Error(err)
	}
	a, err := parser.Parse(jsonData)
	if err != nil {
		t.Error(err)
	}
	agg, succ := a.(*elastic.DerivativeAggregation)
	if !succ {
		t.Error("aggregation type should be *elastic.DerivativeAggregation")
	}
	src, err := agg.Source()
	if err != nil {
		t.Error(err)
	}
	srcStr, err := json.Marshal(src)
	if err != nil {
		t.Error(err)
	}
	assert.T(t, strings.Contains(string(srcStr), `"buckets_path":"3"`))
	assert.T(t, strings.Contains(string(srcStr), `"unit":"10s"`))
	assert.T(t, strings.Contains(string(srcStr), `"derivative"`))
}
