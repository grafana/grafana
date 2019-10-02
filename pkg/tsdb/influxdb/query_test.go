package influxdb

import (
	"testing"
	"time"

	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryBuilder(t *testing.T) {

	Convey("Influxdb query builder", t, func() {

		qp1, _ := NewQueryPart("field", []string{"value"})
		qp2, _ := NewQueryPart("mean", []string{})

		mathPartDivideBy100, _ := NewQueryPart("math", []string{"/ 100"})
		mathPartDivideByIntervalMs, _ := NewQueryPart("math", []string{"/ $__interval_ms"})

		groupBy1, _ := NewQueryPart("time", []string{"$__interval"})
		groupBy2, _ := NewQueryPart("tag", []string{"datacenter"})
		groupBy3, _ := NewQueryPart("fill", []string{"null"})

		groupByOldInterval, _ := NewQueryPart("time", []string{"$interval"})

		tag1 := &Tag{Key: "hostname", Value: "server1", Operator: "="}
		tag2 := &Tag{Key: "hostname", Value: "server2", Operator: "=", Condition: "OR"}

		queryContext := &tsdb.TsdbQuery{
			TimeRange: tsdb.NewTimeRange("5m", "now"),
		}

		Convey("can build simple query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy3},
				Interval:    time.Second * 10,
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "policy"."cpu" WHERE time > now() - 5m GROUP BY time(10s) fill(null)`)
		})

		Convey("can build query with tz", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1},
				Tz:          "Europe/Paris",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "cpu" WHERE time > now() - 5m GROUP BY time(5s) tz('Europe/Paris')`)
		})

		Convey("can build query with group bys", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				GroupBy:     []*QueryPart{groupBy1, groupBy2, groupBy3},
				Tags:        []*Tag{tag1, tag2},
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "cpu" WHERE ("hostname" = 'server1' OR "hostname" = 'server2') AND time > now() - 5m GROUP BY time(5s), "datacenter" fill(null)`)
		})

		Convey("can build query with math part", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2, *mathPartDivideBy100}},
				Measurement: "cpu",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") / 100 FROM "cpu" WHERE time > now() - 5m`)
		})

		Convey("can build query with math part using $__interval_ms variable", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2, *mathPartDivideByIntervalMs}},
				Measurement: "cpu",
				Interval:    time.Second * 5,
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") / 5000 FROM "cpu" WHERE time > now() - 5m`)
		})

		Convey("can build query with old $interval variable", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "",
				GroupBy:     []*QueryPart{groupByOldInterval},
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `SELECT mean("value") FROM "cpu" WHERE time > now() - 5m GROUP BY time(200ms)`)
		})

		Convey("can render time range", func() {
			query := Query{}
			Convey("render from: 2h to now-1h", func() {
				query := Query{}
				queryContext := &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("2h", "now-1h")}
				So(query.renderTimeFilter(queryContext), ShouldEqual, "time > now() - 2h and time < now() - 1h")
			})

			Convey("render from: 10m", func() {
				queryContext := &tsdb.TsdbQuery{TimeRange: tsdb.NewTimeRange("10m", "now")}
				So(query.renderTimeFilter(queryContext), ShouldEqual, "time > now() - 10m")
			})
		})

		Convey("can build query from raw query", func() {
			query := &Query{
				Selects:     []*Select{{*qp1, *qp2}},
				Measurement: "cpu",
				Policy:      "policy",
				GroupBy:     []*QueryPart{groupBy1, groupBy3},
				Interval:    time.Second * 10,
				RawQuery:    "Raw query",
				UseRawQuery: true,
			}

			rawQuery, err := query.Build(queryContext)
			So(err, ShouldBeNil)
			So(rawQuery, ShouldEqual, `Raw query`)
		})

		Convey("can render normal tags without operator", func() {
			query := &Query{Tags: []*Tag{{Operator: "", Value: `value`, Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" = 'value'`)
		})

		Convey("can render regex tags without operator", func() {
			query := &Query{Tags: []*Tag{{Operator: "", Value: `/value/`, Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" =~ /value/`)
		})

		Convey("can render regex tags", func() {
			query := &Query{Tags: []*Tag{{Operator: "=~", Value: `/value/`, Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" =~ /value/`)
		})

		Convey("can render number tags", func() {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: "10001", Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" = '10001'`)
		})

		Convey("can render numbers less then condition tags", func() {
			query := &Query{Tags: []*Tag{{Operator: "<", Value: "10001", Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" < 10001`)
		})

		Convey("can render number greater then condition tags", func() {
			query := &Query{Tags: []*Tag{{Operator: ">", Value: "10001", Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" > 10001`)
		})

		Convey("can render string tags", func() {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: "value", Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" = 'value'`)
		})

		Convey("can escape backslashes when rendering string tags", func() {
			query := &Query{Tags: []*Tag{{Operator: "=", Value: `C:\test\`, Key: "key"}}}

			So(strings.Join(query.renderTags(), ""), ShouldEqual, `"key" = 'C:\\test\\'`)
		})

		Convey("can render regular measurement", func() {
			query := &Query{Measurement: `apa`, Policy: "policy"}

			So(query.renderMeasurement(), ShouldEqual, ` FROM "policy"."apa"`)
		})

		Convey("can render regexp measurement", func() {
			query := &Query{Measurement: `/apa/`, Policy: "policy"}

			So(query.renderMeasurement(), ShouldEqual, ` FROM "policy"./apa/`)
		})
	})

}
