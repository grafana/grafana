package es2

import (
	"encoding/json"
	"fmt"
	"math"
	"testing"

	"github.com/bmizerany/assert"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/models"
	"gopkg.in/olivere/elastic.v3"
)

func TestCountResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":6,"_scroll_id":"","hits":{"total":68108,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501068480000","key":1501068480000,"doc_count":27464},` +
		`{"key_as_string":"1501068540000","key":1501068540000,"doc_count":40644},{"key_as_string":"1501068600000",` +
		`"key":1501068600000,"doc_count":0}]}},"timed_out":false,"terminated_early":false,"_shards":` +
		`{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeCount
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("3", aggType, dhAgg.Buckets)
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestAvgResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":15,"_scroll_id":"","hits":{"total":61170,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501070640000","key":1501070640000,"doc_count":19316,"1":` +
		`{"value":25.720490784841584}},{"key_as_string":"1501070700000","key":1501070700000,"doc_count":38306,"1":` +
		`{"value":21.1563462642928}},{"key_as_string":"1501070760000","key":1501070760000,"doc_count":3548,"1":{"value":` +
		`17.328635851183765}}]}},"timed_out":false,"terminated_early":false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeAvg
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestSumResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":46,"_scroll_id":"","hits":{"total":58327,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501071720000","key":1501071720000,"doc_count":21868,"1":` +
		`{"value":4378480.0}},{"key_as_string":"1501071780000","key":1501071780000,"doc_count":36459,"1":{"value":` +
		`7470610.0}},{"key_as_string":"1501071840000","key":1501071840000,"doc_count":0,"1":{"value":0.0}}]}},"timed_out":` +
		`false,"terminated_early":false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeSum
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestMaxResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":62,"_scroll_id":"","hits":{"total":66710,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501071840000","key":1501071840000,"doc_count":18636,"1":{` +
		`"value":14600.0}},{"key_as_string":"1501071900000","key":1501071900000,"doc_count":41421,"1":{"value":14600.0}},` +
		`{"key_as_string":"1501071960000","key":1501071960000,"doc_count":6653,"1":{"value":12930.0}}]}},"timed_out":false,` +
		`"terminated_early":false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeMax
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestMinResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":62,"_scroll_id":"","hits":{"total":66710,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501071840000","key":1501071840000,"doc_count":18636,"1":{` +
		`"value":14600.0}},{"key_as_string":"1501071900000","key":1501071900000,"doc_count":41421,"1":{"value":14600.0}},` +
		`{"key_as_string":"1501071960000","key":1501071960000,"doc_count":6653,"1":{"value":12930.0}}]}},"timed_out":false,` +
		`"terminated_early":false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeMin
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestStatsResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":36,"_scroll_id":"","hits":{"total":70063,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501072140000","key":1501072140000,"doc_count":36403,"1":{` +
		`"count":36403,"min":0.0,"max":14600.0,"avg":199.67063154135647,"sum":7268610.0,"sum_of_squares":4.45312035E10,` +
		`"variance":1183415.5303373947,"std_deviation":1087.8490383952153,"std_deviation_bounds":{"upper":` +
		`2375.3687083317873,"lower":-1976.0274452490742}}},{"key_as_string":"1501072200000","key":1501072200000,` +
		`"doc_count":33660,"1":{"count":33660,"min":0.0,"max":14600.0,"avg":184.7058823529412,"sum":6217200.0,` +
		`"sum_of_squares":3.64409264E10,"variance":1048501.871308238,"std_deviation":1023.9638037099935,` +
		`"std_deviation_bounds":{"upper":2232.633489772928,"lower":-1863.2217250670458}}},{"key_as_string":"1501072260000",` +
		`"key":1501072260000,"doc_count":0,"1":{"count":0,"min":null,"max":null,"avg":null,"sum":null,"sum_of_squares":null,` +
		`"variance":null,"std_deviation":null,"std_deviation_bounds":{"upper":null,"lower":null}}}]}},"timed_out":false,` +
		`"terminated_early":false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeExtendedStats
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	// max, min, count, avg, sum, std_deviation
	assert.Equal(t, len(ss), 6)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestPercentilesResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":242,"_scroll_id":"","hits":{"total":72125,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501073040000","key":1501073040000,"doc_count":39892,"1":{` +
		`"values":{"25.0":20.0,"50.0":20.0}}},{"key_as_string":"1501073100000","key":1501073100000,"doc_count":32233,"1":` +
		`{"values":{"25.0":20.0,"50.0":20.000000000000004}}},{"key_as_string":"1501073160000","key":1501073160000,` +
		`"doc_count":0,"1":{"values":{"25.0":"NaN","50.0":"NaN"}}}]}},"timed_out":false,"terminated_early":false,` +
		`"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypePercentiles
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	// max, min, count, avg, sum, std_deviation
	assert.Equal(t, len(ss), 2)
	assert.Equal(t, len(ss[0].Points), 3)
}

func TestCardinalityResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":12,"_scroll_id":"","hits":{"total":73870,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501073100000","key":1501073100000,"doc_count":732,"1":{"value"` +
		`:14}},{"key_as_string":"1501073160000","key":1501073160000,"doc_count":45640,"1":{"value":38}},{"key_as_string":` +
		`"1501073220000","key":1501073220000,"doc_count":27498,"1":{"value":34}}]}},"timed_out":false,"terminated_early":` +
		`false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeCardinality
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	// max, min, count, avg, sum, std_deviation
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 3)
	assert.T(t, (ss[0].Points[0][0].Float64-14) <= 1e-12)
}

func TestMovAvgResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":11,"_scroll_id":"","hits":{"total":65230,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501073400000","key":1501073400000,"doc_count":22076,"3":{` +
		`"value":19.263272331944194}},{"key_as_string":"1501073460000","key":1501073460000,"doc_count":42768,"3":{"value"` +
		`:19.23982884399551},"1":{"value":19.263272331944194}},{"key_as_string":"1501073520000","key":1501073520000,` +
		`"doc_count":386,"3":{"value":22.121761658031087},"1":{"value":19.251550587969852}}]}},"timed_out":false,` +
		`"terminated_early":false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeMovAvg
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	// max, min, count, avg, sum, std_deviation
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 2)
	assert.T(t, math.Abs(ss[0].Points[0][0].Float64-19.263272331944194) <= 1e-12)
}

func TestDerivativeResponseMetricParser_Parse(t *testing.T) {
	data := `{"responses":[{"took":12,"_scroll_id":"","hits":{"total":55968,"max_score":0,"hits":[]},"suggest":null,` +
		`"aggregations":{"2":{"buckets":[{"key_as_string":"1501073580000","key":1501073580000,"doc_count":29125,"3":` +
		`{"value":18.973321888412016}},{"key_as_string":"1501073640000","key":1501073640000,"doc_count":26843,"3":` +
		`{"value":18.377603099504526},"1":{"value":-0.5957187889074902}},{"key_as_string":"1501073700000","key":` +
		`1501073700000,"doc_count":0,"3":{"value":null},"1":{"value":null}}]}},"timed_out":false,"terminated_early":` +
		`false,"_shards":{"failed":0,"successful":4,"total":4}}]}`
	id := "2"
	aggType := models.MetricTypeDerivative
	ms := &elastic.MultiSearchResult{}
	err := json.Unmarshal([]byte(data), ms)
	if err != nil {
		t.Error(err)
	}
	parser := GetMetricResponseParser(aggType)
	dhAgg, succ := ms.Responses[0].Aggregations.DateHistogram(id)
	if !succ {
		t.Error("not date histogram")
	}
	ss := parser.Parse("1", aggType, dhAgg.Buckets)
	// max, min, count, avg, sum, std_deviation
	assert.Equal(t, len(ss), 1)
	assert.Equal(t, len(ss[0].Points), 2)
	fmt.Println(ss[0].Points[0][0].Float64)
	assert.T(t, (ss[0].Points[0][0].Float64-(-0.5957187889074902)) <= 1e-12)
}
