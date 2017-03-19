package elasticsearch

import (
	"testing"

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
