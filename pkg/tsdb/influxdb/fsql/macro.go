package fsql

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

var macros = sqlutil.Macros{
	"dateBin":        macroDateBin(""),
	"dateBinAlias":   macroDateBin("_binned"),
	"interval":       macroInterval,
	"timeGroup":      macroTimeGroup,
	"timeGroupAlias": macroTimeGroupAlias,

	// The behaviors of timeFrom and timeTo as defined in the SDK are different
	// from all other Grafana SQL plugins. Instead we'll take their
	// implementations, rename them and define timeFrom and timeTo ourselves.
	"timeRangeFrom": sqlutil.DefaultMacros["timeFrom"],
	"timeRangeTo":   sqlutil.DefaultMacros["timeTo"],
	"timeRange":     sqlutil.DefaultMacros["timeFilter"],
	"timeTo":        macroTo,
	"timeFrom":      macroFrom,
}

func macroTimeGroup(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 2 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}

	column := args[0]

	res := ""
	switch args[1] {
	case "minute":
		res += fmt.Sprintf("datepart('minute', %s),", column)
		fallthrough
	case "hour":
		res += fmt.Sprintf("datepart('hour', %s),", column)
		fallthrough
	case "day":
		res += fmt.Sprintf("datepart('day', %s),", column)
		fallthrough
	case "month":
		res += fmt.Sprintf("datepart('month', %s),", column)
		fallthrough
	case "year":
		res += fmt.Sprintf("datepart('year', %s)", column)
	}

	return res, nil
}

func macroTimeGroupAlias(query *sqlutil.Query, args []string) (string, error) {
	if len(args) != 2 {
		return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
	}

	column := args[0]

	res := ""
	switch args[1] {
	case "minute":
		res += fmt.Sprintf("datepart('minute', %s) as %s_minute,", column, column)
		fallthrough
	case "hour":
		res += fmt.Sprintf("datepart('hour', %s) as %s_hour,", column, column)
		fallthrough
	case "day":
		res += fmt.Sprintf("datepart('day', %s) as %s_day,", column, column)
		fallthrough
	case "month":
		res += fmt.Sprintf("datepart('month', %s) as %s_month,", column, column)
		fallthrough
	case "year":
		res += fmt.Sprintf("datepart('year', %s) as %s_year", column, column)
	}

	return res, nil
}

func macroInterval(query *sqlutil.Query, _ []string) (string, error) {
	return fmt.Sprintf("interval '%d second'", int64(query.Interval.Seconds())), nil
}

func macroFrom(query *sqlutil.Query, _ []string) (string, error) {
	return fmt.Sprintf("cast('%s' as timestamp)", query.TimeRange.From.Format(time.RFC3339)), nil
}

func macroTo(query *sqlutil.Query, _ []string) (string, error) {
	return fmt.Sprintf("cast('%s' as timestamp)", query.TimeRange.To.Format(time.RFC3339)), nil
}

func macroDateBin(suffix string) sqlutil.MacroFunc {
	return func(query *sqlutil.Query, args []string) (string, error) {
		if len(args) != 1 {
			return "", fmt.Errorf("%w: expected 1 argument, received %d", sqlutil.ErrorBadArgumentCount, len(args))
		}
		column := args[0]
		aliasing := func() string {
			if suffix == "" {
				return ""
			}
			return fmt.Sprintf(" as %s%s", column, suffix)
		}()
		return fmt.Sprintf("date_bin(interval '%d second', %s, timestamp '1970-01-01T00:00:00Z')%s", int64(query.Interval.Seconds()), column, aliasing), nil
	}
}
