package elasticsearch

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestElasticsearchMetricGetName(t *testing.T) {
	Convey("Test ElasticSearch GetName ", t, func() {

		Convey("Avg", func() {
			m := Metric{
				Type:  "avg",
				Field: "value",
			}
			So(m.GetName().Value, ShouldEqual, "Average value")
		})

		Convey("Sum", func() {
			m := Metric{
				Type:  "sum",
				Field: "value",
			}
			So(m.GetName().Value, ShouldEqual, "Sum value")
		})

		Convey("Max", func() {
			m := Metric{
				Type:  "max",
				Field: "value",
			}
			So(m.GetName().Value, ShouldEqual, "Max value")
		})

		Convey("Min", func() {
			m := Metric{
				Type:  "min",
				Field: "value",
			}
			So(m.GetName().Value, ShouldEqual, "Min value")
		})

	})

	Convey("Test ElasticSearch GetName with Pipeline Aggregate ", t, func() {
		Convey("Moving Average", func() {
			m := Metric{
				Type:              "moving_avg",
				Field:             "1",
				PipelineAggregate: "1",
			}
			So(m.GetName().Value, ShouldEqual, "Moving Average")
			So(m.GetName().Reference, ShouldEqual, "1")

			names := NameMap{}
			names["1"] = Name{
				Value:     "Moving Average",
				Reference: "2",
			}
			names["2"] = Name{
				Value:     "Nested Value",
				Reference: "",
			}

			So(names.GetName("1"), ShouldEqual, "Moving Average Nested Value")
		})
	})
}

func TestGetFilteredMap(t *testing.T) {
	Convey("Test ElasticSearch GetFilteredMap ", t, func() {
		Convey("Filtered Metrics", func() {
			testModelJSON := `
		{
					"metrics": [
						{
							"field": "value",
							"id": "1",
							"type": "avg",
							"hide": true
						},
						{
							"field": "1",
							"id": "3",
							"pipelineAgg": "1",
							"type": "moving_avg"
						}
					]
		}`
			queries := &tsdb.Query{}
			var err error
			queries.Model, err = simplejson.NewJson([]byte(testModelJSON))
			So(err, ShouldBeNil)

			filters := getFilteredMetrics(queries)
			So(len(filters), ShouldEqual, 2)

			So(filters.Hide("3"), ShouldEqual, false)
			So(filters.Hide("1"), ShouldEqual, true)
			So(filters.Hide("???"), ShouldEqual, false)

		})
	})
}
