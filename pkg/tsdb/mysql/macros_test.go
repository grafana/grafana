package mysql

import (
	"fmt"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/require"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &mySQLMacroEngine{
			logger: log.New("test"),
		}
		query := plugins.DataSubQuery{}

		Convey("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func() {
			from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
			to := from.Add(5 * time.Minute)
			timeRange := plugins.DataTimeRange{From: "5m", Now: to, To: "now"}

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
			timeRange := plugins.NewDataTimeRange(
				strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

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
			timeRange := plugins.NewDataTimeRange(
				strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

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
				_, err := engine.Interpolate(plugins.DataSubQuery{}, plugins.DataTimeRange{}, tc)
				So(err.Error(), ShouldEqual, "invalid query - inspect Grafana server log for details")
			}
		})
	})
}

func TestMacroEngineConcurrency(t *testing.T) {
	engine := newMysqlMacroEngine(log.New("test"))
	query1 := plugins.DataSubQuery{
		Model: simplejson.New(),
	}
	query2 := plugins.DataSubQuery{
		Model: simplejson.New(),
	}
	from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
	to := from.Add(5 * time.Minute)
	timeRange := plugins.DataTimeRange{From: "5m", To: "now", Now: to}

	var wg sync.WaitGroup
	wg.Add(2)

	go func(query plugins.DataSubQuery) {
		defer wg.Done()
		_, err := engine.Interpolate(query, timeRange, "SELECT $__timeGroup(time_column,'5m')")
		require.NoError(t, err)
	}(query1)

	go func(query plugins.DataSubQuery) {
		_, err := engine.Interpolate(query, timeRange, "SELECT $__timeGroup(time_column,'5m')")
		require.NoError(t, err)
		defer wg.Done()
	}(query2)

	wg.Wait()
}
