package kairosdb

import (
	"testing"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestKairosDbMetricParser(t *testing.T) {

	Convey("kairosDb metric parser", t, func() {

		parser := &KairosDbMetricParser{}

		Convey("can parse range aggregator json model", func() {

			var aggBlob = []byte(`{"name": "avg", "sampling_rate": "1s"}`)
			model, _ := simplejson.NewJson(aggBlob)

			aggregator := parser.parseAggregator(model)

			So(aggregator["name"], ShouldEqual, "avg")
			So(aggregator["align_sampling"], ShouldEqual, true)
			So(aggregator["sampling"].(map[string]interface{})["unit"], ShouldEqual, "seconds")
			So(aggregator["sampling"].(map[string]interface{})["value"], ShouldEqual, 1)


		})

		Convey("can parse divide aggregator json model", func() {
			var aggBlob = []byte(`{"name": "div", "factor": "1"}`)
			model, _ := simplejson.NewJson(aggBlob)

			aggregator := parser.parseAggregator(model)

			So(aggregator["name"], ShouldEqual, "div")
			So(aggregator["divisor"], ShouldEqual, float64(1))

		})

		Convey("can parse scale aggregator json model", func() {
			var aggBlob = []byte(`{"name": "scale", "factor": "1.43"}`)
			model, _ := simplejson.NewJson(aggBlob)

			aggregator := parser.parseAggregator(model)

			So(aggregator["name"], ShouldEqual, "scale")
			So(aggregator["factor"], ShouldEqual, 1.43)

		})

		Convey("can parse kairosdb json model", func() {

			var modelBlob = []byte(`{"metric": "kairosdb.metric",
				"horizontalAggregators": [{
					"name": "avg",
					"sampling_rate": "1s"
				},{
					"name": "dev",
					"sampling_rate": "10s"
				}]}`)

			model, _ := simplejson.NewJson(modelBlob)

			metric := parser.Parse(model)
			So(metric["name"], ShouldEqual, "kairosdb.metric")
			So(len(metric["aggregators"].([]interface{})), ShouldEqual, 2)
		})
		
		Convey("can parse kairosdb json model with goup by time", func() {

			var modelBlob = []byte(`{"metric": "kairosdb.metric",
				"nonTagGroupBys": [ {"name":"time", "range_size": "1s"}]}`)

			model, _ := simplejson.NewJson(modelBlob)

			metric := parser.Parse(model)
			So(metric["name"], ShouldEqual, "kairosdb.metric")
			So(len(metric["group_by"].([]interface{})), ShouldEqual, 1)
			// ugly 
			So(metric["group_by"].([]interface{})[0].(map[string]interface{})["range_size"].(map[string]interface{})["unit"].(string), ShouldEqual, "seconds")
		})
		
		Convey("can parse kairosdb json model with goup by tags", func() {

			var modelBlob = []byte(`{"metric": "kairosdb.metric",
				"groupByTags": [ "tag1", "tag2"]}`)

			model, _ := simplejson.NewJson(modelBlob)

			metric := parser.Parse(model)
			So(metric["name"], ShouldEqual, "kairosdb.metric")
			So(len(metric["group_by"].([]interface{})), ShouldEqual, 1)
			// ugly 
			So(len(metric["group_by"].([]interface{})[0].(map[string]interface{})["tags"].([]interface{})), ShouldEqual, 2)
		})
	})
}
