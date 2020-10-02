package mssql

import (
	"fmt"
	"strconv"
	"testing"

	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &msSqlMacroEngine{}
		query := &tsdb.Query{
			Model: simplejson.New(),
		}

		Convey("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func() {
			from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
			to := from.Add(5 * time.Minute)
			timeRange := tsdb.NewFakeTimeRange("5m", "now", to)

			Convey("interpolate __time function", func() {
				sql, err := engine.Interpolate(query, nil, "select $__time(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select time_column AS time")
			})

			Convey("interpolate __timeEpoch function", func() {
				sql, err := engine.Interpolate(query, nil, "select $__timeEpoch(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select DATEDIFF(second, '1970-01-01', time_column) AS time")
			})

			Convey("interpolate __timeEpoch function wrapped in aggregation", func() {
				sql, err := engine.Interpolate(query, nil, "select min($__timeEpoch(time_column))")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select min(DATEDIFF(second, '1970-01-01', time_column) AS time)")
			})

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339), to.Format(time.RFC3339)))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select '2018-04-12T18:00:00Z'")
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select '2018-04-12T18:05:00Z'")
			})

			Convey("interpolate __timeGroup function", func() {
				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
				So(err, ShouldBeNil)
				sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column,'5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY FLOOR(DATEDIFF(second, '1970-01-01', time_column)/300)*300")
				So(sql2, ShouldEqual, sql+" AS [time]")
			})

			Convey("interpolate __timeGroup function with spaces around arguments", func() {
				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
				So(err, ShouldBeNil)
				sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column , '5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY FLOOR(DATEDIFF(second, '1970-01-01', time_column)/300)*300")
				So(sql2, ShouldEqual, sql+" AS [time]")
			})

			Convey("interpolate __timeGroup function with fill (value = NULL)", func() {
				_, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m', NULL)")

				fill := query.Model.Get("fill").MustBool()
				fillMode := query.Model.Get("fillMode").MustString()
				fillInterval := query.Model.Get("fillInterval").MustInt()

				So(err, ShouldBeNil)
				So(fill, ShouldBeTrue)
				So(fillMode, ShouldEqual, "null")
				So(fillInterval, ShouldEqual, 5*time.Minute.Seconds())
			})

			Convey("interpolate __timeGroup function with fill (value = previous)", func() {
				_, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m', previous)")

				fill := query.Model.Get("fill").MustBool()
				fillMode := query.Model.Get("fillMode").MustString()
				fillInterval := query.Model.Get("fillInterval").MustInt()

				So(err, ShouldBeNil)
				So(fill, ShouldBeTrue)
				So(fillMode, ShouldEqual, "previous")
				So(fillInterval, ShouldEqual, 5*time.Minute.Seconds())
			})

			Convey("interpolate __timeGroup function with fill (value = float)", func() {
				_, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m', 1.5)")

				fill := query.Model.Get("fill").MustBool()
				fillValue := query.Model.Get("fillValue").MustFloat64()
				fillInterval := query.Model.Get("fillInterval").MustInt()

				So(err, ShouldBeNil)
				So(fill, ShouldBeTrue)
				So(fillValue, ShouldEqual, 1.5)
				So(fillInterval, ShouldEqual, 5*time.Minute.Seconds())
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochNanoFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.UnixNano(), to.UnixNano()))
			})
			Convey("interpolate __unixEpochNanoFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", from.UnixNano()))
			})

			Convey("interpolate __unixEpochNanoTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", to.UnixNano()))
			})

			Convey("interpolate __unixEpochGroup function", func() {
				sql, err := engine.Interpolate(query, timeRange, "SELECT $__unixEpochGroup(time_column,'5m')")
				So(err, ShouldBeNil)
				sql2, err := engine.Interpolate(query, timeRange, "SELECT $__unixEpochGroupAlias(time_column,'5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "SELECT FLOOR(time_column/300)*300")
				So(sql2, ShouldEqual, sql+" AS [time]")
			})
		})

		Convey("Given a time range between 1960-02-01 07:00 and 1965-02-03 08:00", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1965, 2, 3, 8, 0, 0, 0, time.UTC)
			timeRange := tsdb.NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339), to.Format(time.RFC3339)))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochNanoFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.UnixNano(), to.UnixNano()))
			})
		})

		Convey("Given a time range between 1960-02-01 07:00 and 1980-02-03 08:00", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1980, 2, 3, 8, 0, 0, 0, time.UTC)
			timeRange := tsdb.NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339), to.Format(time.RFC3339)))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochNanoFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.UnixNano(), to.UnixNano()))
			})
		})
	})
}
