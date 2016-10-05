package influxdb

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryBuilder(t *testing.T) {
	Convey("Influxdb query builder", t, func() {
		builder := QueryBuild{}

		qp1, _ := NewQueryPart("field", []string{"value"})
		qp2, _ := NewQueryPart("mean", []string{})

		groupBy1, _ := NewQueryPart("time", []string{"$interval"})
		groupBy2, _ := NewQueryPart("fill", []string{"null"})

		tag1 := &Tag{Key: "hostname", Value: "server1", Operator: "="}
		tag2 := &Tag{Key: "hostname", Value: "server2", Operator: "=", Condition: "OR"}

		Convey("can build query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy2},
			}

			rawQuery, err := builder.Build(query)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "policy"."cpu" WHERE $timeFilter GROUP BY time($interval) fill(null)`)
		})

		Convey("can asd query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1},
				Tags:        []*Tag{tag1, tag2},
			}

			rawQuery, err := builder.Build(query)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "cpu" WHERE "hostname" = 'server1' OR "hostname" = 'server2' AND $timeFilter GROUP BY time($interval)`)
		})
	})
}
