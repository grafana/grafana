package mysql

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &mySqlMacroEngine{
			logger: log.New("test"),
		}
		query := &tsdb.Query{}

		Convey("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func() {
			from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
			to := from.Add(5 * time.Minute)
			timeRange := tsdb.NewFakeTimeRange("5m", "now", to)

			Convey("interpolate __time function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__time(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select UNIX_TIMESTAMP(time_column) as time_sec")
			})

			Convey("interpolate __time function wrapped in aggregation", func() {
				sql, err := engine.Interpolate(query, timeRange, "select min($__time(time_column))")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select min(UNIX_TIMESTAMP(time_column) as time_sec)")
			})

			Convey("interpolate __timeGroup function", func() {
				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
				So(err, ShouldBeNil)
				sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column,'5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY UNIX_TIMESTAMP(time_column) DIV 300 * 300")
				So(sql2, ShouldEqual, sql+" AS \"time\"")
			})

			Convey("interpolate __timeGroup function with spaces around arguments", func() {
				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
				So(err, ShouldBeNil)
				sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column , '5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY UNIX_TIMESTAMP(time_column) DIV 300 * 300")
				So(sql2, ShouldEqual, sql+" AS \"time\"")
			})

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN FROM_UNIXTIME(%d) AND FROM_UNIXTIME(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", from.Unix()))
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", to.Unix()))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochNanoFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.UnixNano(), to.UnixNano()))
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

				So(sql, ShouldEqual, "SELECT time_column DIV 300 * 300")
				So(sql2, ShouldEqual, sql+" AS \"time\"")
			})
		})

		Convey("Given a time range between 1960-02-01 07:00 and 1965-02-03 08:00", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1965, 2, 3, 8, 0, 0, 0, time.UTC)
			timeRange := tsdb.NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN FROM_UNIXTIME(%d) AND FROM_UNIXTIME(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()))
			})
		})

		Convey("Given a time range between 1960-02-01 07:00 and 1980-02-03 08:00", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1980, 2, 3, 8, 0, 0, 0, time.UTC)
			timeRange := tsdb.NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column BETWEEN FROM_UNIXTIME(%d) AND FROM_UNIXTIME(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __unixEpochFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()))
			})
		})

		Convey("Given queries that contains unallowed user functions", func() {
			tcs := []string{
				"select \nSESSION_USER(), abc",
				"SELECT session_User( ) ",
				"SELECT session_User(	)\n",
				"SELECT current_user",
				"SELECT current_USER",
				"SELECT current_user()",
				"SELECT Current_User()",
				"SELECT current_user(   )",
				"SELECT current_user(\t )",
				"SELECT user()",
				"SELECT USER()",
				"SELECT SYSTEM_USER()",
				"SELECT System_User()",
				"SELECT System_User(  )",
				"SELECT System_User(\t \t)",
				"SHOW \t grants",
				" show Grants\n",
				"show grants;",
			}

			for _, tc := range tcs {
				_, err := engine.Interpolate(nil, nil, tc)
				So(err.Error(), ShouldEqual, "Invalid query. Inspect Grafana server log for details")
			}
		})
	})
}
