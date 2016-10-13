package influxdb

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryBuilder(t *testing.T) {

	Convey("Influxdb query builder", t, func() {
		builder := QueryBuilder{}

		qp1, _ := NewQueryPart("field", []string{"value"})
		qp2, _ := NewQueryPart("mean", []string{})

		groupBy1, _ := NewQueryPart("time", []string{"$interval"})
		groupBy2, _ := NewQueryPart("tag", []string{"datacenter"})
		groupBy3, _ := NewQueryPart("fill", []string{"null"})

		tag1 := &Tag{Key: "hostname", Value: "server1", Operator: "="}
		tag2 := &Tag{Key: "hostname", Value: "server2", Operator: "=", Condition: "OR"}

		queryContext := &tsdb.QueryContext{
			TimeRange: tsdb.NewTimeRange("5m", "now"),
		}

		Convey("can build simple query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy3},
				Interval:    "10s",
			}

			rawQuery, err := builder.Build(query, queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "policy"."cpu" WHERE time > now() - 5m GROUP BY time(10s) fill(null)`)
		})

		Convey("can build query with group bys", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1, groupBy2, groupBy3},
				Tags:        []*Tag{tag1, tag2},
				Interval:    "5s",
			}

			rawQuery, err := builder.Build(query, queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "cpu" WHERE "hostname" = 'server1' OR "hostname" = 'server2' AND time > now() - 5m GROUP BY time(5s), "datacenter" fill(null)`)
		})

		Convey("can render time range", func() {
			query := Query{}
			builder := &QueryBuilder{}
			Convey("render from: 2h to now-1h", func() {
				query := Query{}
				queryContext := &tsdb.QueryContext{TimeRange: tsdb.NewTimeRange("2h", "now-1h")}
				So(builder.renderTimeFilter(&query, queryContext), ShouldEqual, "time > now() - 2h and time < now() - 1h")
			})

			Convey("render from: 10m", func() {
				queryContext := &tsdb.QueryContext{TimeRange: tsdb.NewTimeRange("10m", "now")}
				So(builder.renderTimeFilter(&query, queryContext), ShouldEqual, "time > now() - 10m")
			})
		})

		Convey("can build query from raw query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy3},
				Interval:    "10s",
				RawQuery:    "Raw query",
			}

			rawQuery, err := builder.Build(query, queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `Raw query`)
		})
	})
}
