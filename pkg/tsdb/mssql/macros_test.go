package mssql

import (
	"fmt"
	"strconv"
	"sync"
	"testing"

	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/plugins"
	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/require"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &msSQLMacroEngine{}
		query := plugins.DataSubQuery{
			Model: simplejson.New(),
		}

		dfltTimeRange := plugins.DataTimeRange{}

		Convey("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func() {
			from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
			to := from.Add(5 * time.Minute)
			timeRange := plugins.DataTimeRange{From: "5m", Now: to, To: "now"}

			Convey("interpolate __time function", func() {
				sql, err := engine.Interpolate(query, dfltTimeRange, "select $__time(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select time_column AS time")
			})

			Convey("interpolate __timeEpoch function", func() {
				sql, err := engine.Interpolate(query, dfltTimeRange, "select $__timeEpoch(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select DATEDIFF(second, '1970-01-01', time_column) AS time")
			})

			Convey("interpolate __timeEpoch function wrapped in aggregation", func() {
				sql, err := engine.Interpolate(query, dfltTimeRange, "select min($__timeEpoch(time_column))")
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
			timeRange := plugins.NewDataTimeRange(
				strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10),
				strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

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
			timeRange := plugins.NewDataTimeRange(
				strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10),
				strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

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

func TestMacroEngineConcurrency(t *testing.T) {
	engine := newMssqlMacroEngine()
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
