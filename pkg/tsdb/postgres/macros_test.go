package postgres

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := NewPostgresMacroEngine()
		// datasource with no pg version specified
		ds := &models.DataSource{Id: 1, Type: "postgres", JsonData: simplejson.New()}
		// datasource with postgres 8.0 configured
		ds_80 := &models.DataSource{Id: 2, Type: "postgres", JsonData: simplejson.New()}
		ds_80.JsonData.Set("postgresVersion", 80000)
		// datasource with postgres 8.1 configured
		ds_81 := &models.DataSource{Id: 3, Type: "postgres", JsonData: simplejson.New()}
		ds_81.JsonData.Set("postgresVersion", 80100)

		query := &tsdb.Query{RefId: "A", DataSource: ds}
		query_80 := &tsdb.Query{RefId: "A", DataSource: ds_80}
		query_81 := &tsdb.Query{RefId: "A", DataSource: ds_81}

		Convey("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func() {
			from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
			to := from.Add(5 * time.Minute)
			timeRange := tsdb.NewFakeTimeRange("5m", "now", to)

			Convey("interpolate __time function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__time(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select time_column AS \"time\"")
			})

			Convey("interpolate __time function wrapped in aggregation", func() {
				sql, err := engine.Interpolate(query, timeRange, "select min($__time(time_column))")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select min(time_column AS \"time\")")
			})

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN 'epoch'::timestamptz + %d * '1s'::interval AND 'epoch'::timestamptz + %d * '1s'::interval", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFilter function for postgres 8.0", func() {
				sql, err := engine.Interpolate(query_80, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN 'epoch'::timestamptz + %d * '1s'::interval AND 'epoch'::timestamptz + %d * '1s'::interval", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFilter function for postgres 8.1", func() {
				sql, err := engine.Interpolate(query_81, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN to_timestamp(%d) AND to_timestamp(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select to_timestamp(%d)", from.Unix()))
			})

			Convey("interpolate __timeGroup function", func() {

				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY (extract(epoch from time_column)/300)::bigint*300 AS time")
			})

			Convey("interpolate __timeGroup function with spaces between args", func() {

				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY (extract(epoch from time_column)/300)::bigint*300 AS time")
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select to_timestamp(%d)", to.Unix()))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", from.Unix()))
			})

			Convey("interpolate __unixEpochTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", to.Unix()))
			})
		})

		Convey("Given a time range between 1960-02-01 07:00 and 1965-02-03 08:00", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1965, 2, 3, 8, 0, 0, 0, time.UTC)
			timeRange := tsdb.NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN 'epoch'::timestamptz + %d * '1s'::interval AND 'epoch'::timestamptz + %d * '1s'::interval", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFilter function for 8.0", func() {
				sql, err := engine.Interpolate(query_80, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN 'epoch'::timestamptz + %d * '1s'::interval AND 'epoch'::timestamptz + %d * '1s'::interval", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFilter function for 8.1", func() {
				sql, err := engine.Interpolate(query_81, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN to_timestamp(%d) AND to_timestamp(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select to_timestamp(%d)", from.Unix()))
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select to_timestamp(%d)", to.Unix()))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", from.Unix()))
			})

			Convey("interpolate __unixEpochTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", to.Unix()))
			})
		})

		Convey("Given a time range between 1960-02-01 07:00 and 1980-02-03 08:00", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1980, 2, 3, 8, 0, 0, 0, time.UTC)
			timeRange := tsdb.NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN 'epoch'::timestamptz + %d * '1s'::interval AND 'epoch'::timestamptz + %d * '1s'::interval", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFilter function for 8.0", func() {
				sql, err := engine.Interpolate(query_80, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN 'epoch'::timestamptz + %d * '1s'::interval AND 'epoch'::timestamptz + %d * '1s'::interval", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFilter function for 8.1", func() {
				sql, err := engine.Interpolate(query_81, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN to_timestamp(%d) AND to_timestamp(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select to_timestamp(%d)", from.Unix()))
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select to_timestamp(%d)", to.Unix()))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", from.Unix()))
			})

			Convey("interpolate __unixEpochTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", to.Unix()))
			})
		})
	})
}
