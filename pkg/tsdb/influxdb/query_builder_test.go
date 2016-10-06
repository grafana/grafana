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
		groupBy2, _ := NewQueryPart("fill", []string{"null"})

		tag1 := &Tag{Key: "hostname", Value: "server1", Operator: "="}
		tag2 := &Tag{Key: "hostname", Value: "server2", Operator: "=", Condition: "OR"}

		queryContext := &tsdb.QueryContext{
			TimeRange: tsdb.NewTimeRange("now-5m", "now"),
		}

		Convey("can build simple query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy2},
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
				GroupBy:     []*QueryPart{groupBy1},
				Tags:        []*Tag{tag1, tag2},
				Interval:    "5s",
			}

			rawQuery, err := builder.Build(query, queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "cpu" WHERE "hostname" = 'server1' OR "hostname" = 'server2' AND time > now() - 5m GROUP BY time(10s)`)
		})
	})
}
