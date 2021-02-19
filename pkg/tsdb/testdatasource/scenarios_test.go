package testdatasource

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTestdataScenarios(t *testing.T) {
	Convey("random walk ", t, func() {
		scenario := ScenarioRegistry["random_walk"]

		Convey("Should start at the requested value", func() {
			req := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				Queries: []*tsdb.Query{
					{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
				},
			}
			query := req.Queries[0]
			query.Model.Set("startValue", 1.234)

			result := scenario.Handler(req.Queries[0], req)
			points := result.Series[0].Points

			So(result.Series, ShouldNotBeNil)
			So(points[0][0].Float64, ShouldEqual, 1.234)
		})
	})

	Convey("random walk table", t, func() {
		scenario := ScenarioRegistry["random_walk_table"]

		Convey("Should return a table that looks like value/min/max", func() {
			req := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				Queries: []*tsdb.Query{
					{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
				},
			}

			result := scenario.Handler(req.Queries[0], req)
			table := result.Tables[0]

			So(len(table.Rows), ShouldBeGreaterThan, 50)
			for _, row := range table.Rows {
				value := row[1]
				min := row[2]
				max := row[3]

				So(min, ShouldBeLessThan, value)
				So(max, ShouldBeGreaterThan, value)
			}
		})

		Convey("Should return a table with some nil values", func() {
			req := &tsdb.TsdbQuery{
				TimeRange: tsdb.NewFakeTimeRange("5m", "now", time.Now()),
				Queries: []*tsdb.Query{
					{RefId: "A", IntervalMs: 100, MaxDataPoints: 100, Model: simplejson.New()},
				},
			}
			query := req.Queries[0]
			query.Model.Set("withNil", true)

			result := scenario.Handler(req.Queries[0], req)
			table := result.Tables[0]

			nil1 := false
			nil2 := false
			nil3 := false

			So(len(table.Rows), ShouldBeGreaterThan, 50)
			for _, row := range table.Rows {
				if row[1] == nil {
					nil1 = true
				}
				if row[2] == nil {
					nil2 = true
				}
				if row[3] == nil {
					nil3 = true
				}
			}

			So(nil1, ShouldBeTrue)
			So(nil2, ShouldBeTrue)
			So(nil3, ShouldBeTrue)
		})
	})
}

func TestToLabels(t *testing.T) {
	Convey("read labels", t, func() {
		tags := make(map[string]string)
		tags["job"] = "foo"
		tags["instance"] = "bar"

		query1 := tsdb.Query{
			Model: simplejson.NewFromAny(map[string]interface{}{
				"labels": `{job="foo", instance="bar"}`,
			}),
		}

		So(parseLabels(&query1), ShouldResemble, tags)

		query2 := tsdb.Query{
			Model: simplejson.NewFromAny(map[string]interface{}{
				"labels": `job=foo, instance=bar`,
			}),
		}

		So(parseLabels(&query2), ShouldResemble, tags)

		query3 := tsdb.Query{
			Model: simplejson.NewFromAny(map[string]interface{}{
				"labels": `job = foo,instance = bar`,
			}),
		}

		So(parseLabels(&query3), ShouldResemble, tags)
	})
}
