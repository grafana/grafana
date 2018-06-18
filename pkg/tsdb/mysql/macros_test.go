package mysql

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &MySqlMacroEngine{}
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

				So(sql, ShouldEqual, "GROUP BY cast(cast(UNIX_TIMESTAMP(time_column)/(300) as signed)*300 as signed)")
			})

			Convey("interpolate __timeGroup function with spaces around arguments", func() {

				sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "GROUP BY cast(cast(UNIX_TIMESTAMP(time_column)/(300) as signed)*300 as signed)")
			})

			Convey("interpolate __timeFilter function", func() {
				sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column >= FROM_UNIXTIME(%d) AND time_column <= FROM_UNIXTIME(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", from.Unix()))
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", to.Unix()))
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

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column >= FROM_UNIXTIME(%d) AND time_column <= FROM_UNIXTIME(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", from.Unix()))
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", to.Unix()))
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

				So(sql, ShouldEqual, fmt.Sprintf("WHERE time_column >= FROM_UNIXTIME(%d) AND time_column <= FROM_UNIXTIME(%d)", from.Unix(), to.Unix()))
			})

			Convey("interpolate __timeFrom function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", from.Unix()))
			})

			Convey("interpolate __timeTo function", func() {
				sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select FROM_UNIXTIME(%d)", to.Unix()))
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

func wherein(args []string) (string, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("macro %v needs column and params", "wherein")
	}
	columnName := args[0]
	if strings.HasPrefix(columnName, "'") {
		columnName = strings.Trim(columnName, "'")
	}
	if (len(args) == 2) && (args[1] == "ALL" || args[1] == "'ALL'") {
		return "1 = 1", nil
	} else if len(args) == 2 && (args[1] == "NULL" || args[1] == "'NULL'") {
		return fmt.Sprintf("%s IS NULL", columnName), nil
	} else {
		var params = make([]string, 0)
		var hasNull = false
		for _, arg := range args[1:] {
			if arg == "NULL" || arg == "'NULL'" {
				hasNull = true
			} else {
				if !strings.HasPrefix(arg, "'") {
					params = append(params, "'"+arg+"'")
					fmt.Println(strings.Join(params, ","))
				} else {
					params = append(params, arg)
				}
			}
		}
		if hasNull {
			return fmt.Sprintf("%s in (%s) or %s IS NULL", columnName, strings.Join(params, ","), args[0]), nil
		} else {
			return fmt.Sprintf("%s in (%s)", columnName, strings.Join(params, ",")), nil
		}
	}
}

func TestWhereInMacroEngine(t *testing.T) {
	sql, _ := wherein([]string{"sdfsdfd", "净水器"})
	fmt.Println(sql)
}
