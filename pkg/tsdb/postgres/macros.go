package postgres

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type postgresMacroEngine struct {
	*sqleng.SqlMacroEngineBase
	timeRange   *tsdb.TimeRange
	query       *tsdb.Query
	timescaledb bool
}

func newPostgresMacroEngine(timescaledb bool) sqleng.SqlMacroEngine {
	return &postgresMacroEngine{
		SqlMacroEngineBase: sqleng.NewSqlMacroEngineBase(),
		timescaledb:        timescaledb,
	}
}

func (m *postgresMacroEngine) Interpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, sql string) (string, error) {
	m.timeRange = timeRange
	m.query = query
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = m.ReplaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
		// detect if $__timeGroup is supposed to add AS time for pre 5.3 compatibility
		// if there is a ',' directly after the macro call $__timeGroup is probably used
		// in the old way. Inside window function ORDER BY $__timeGroup will be followed
		// by ')'
		if groups[1] == "__timeGroup" {
			if index := strings.Index(sql, groups[0]); index >= 0 {
				index += len(groups[0])
				if len(sql) > index {
					// check for character after macro expression
					if sql[index] == ',' {
						groups[1] = "__timeGroupAlias"
					}
				}
			}
		}

		args := strings.Split(groups[2], ",")
		for i, arg := range args {
			args[i] = strings.Trim(arg, " ")
		}
		res, err := m.evaluateMacro(groups[1], args)
		if err != nil && macroError == nil {
			macroError = err
			return "macro_error()"
		}
		return res
	})

	if macroError != nil {
		return "", macroError
	}

	return sql, nil
}

//nolint: gocyclo
func (m *postgresMacroEngine) evaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__time":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s AS \"time\"", args[0]), nil
	case "__timeEpoch":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("extract(epoch from %s) as \"time\"", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}

		return fmt.Sprintf("%s BETWEEN '%s' AND '%s'", args[0], m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339Nano), m.timeRange.GetToAsTimeUTC().Format(time.RFC3339Nano)), nil
	case "__timeFrom":
		return fmt.Sprintf("'%s'", m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339Nano)), nil
	case "__timeTo":
		return fmt.Sprintf("'%s'", m.timeRange.GetToAsTimeUTC().Format(time.RFC3339Nano)), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval and optional fill value", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := sqleng.SetupFillmode(m.query, interval, args[2])
			if err != nil {
				return "", err
			}
		}

		if m.timescaledb {
			return fmt.Sprintf("time_bucket('%vs',%s)", interval.Seconds(), args[0]), nil
		}

		return fmt.Sprintf(
			"floor(extract(epoch from %s)/%v)*%v", args[0],
			interval.Seconds(),
			interval.Seconds(),
		), nil
	case "__timeGroupAlias":
		tg, err := m.evaluateMacro("__timeGroup", args)
		if err == nil {
			return tg + " AS \"time\"", err
		}
		return "", err
	case "__unixEpochFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= %d AND %s <= %d", args[0], m.timeRange.GetFromAsSecondsEpoch(), args[0], m.timeRange.GetToAsSecondsEpoch()), nil
	case "__unixEpochNanoFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= %d AND %s <= %d", args[0], m.timeRange.GetFromAsTimeUTC().UnixNano(), args[0], m.timeRange.GetToAsTimeUTC().UnixNano()), nil
	case "__unixEpochNanoFrom":
		return fmt.Sprintf("%d", m.timeRange.GetFromAsTimeUTC().UnixNano()), nil
	case "__unixEpochNanoTo":
		return fmt.Sprintf("%d", m.timeRange.GetToAsTimeUTC().UnixNano()), nil
	case "__unixEpochGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval and optional fill value", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := sqleng.SetupFillmode(m.query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("floor(%s/%v)*%v", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__unixEpochGroupAlias":
		tg, err := m.evaluateMacro("__unixEpochGroup", args)
		if err == nil {
			return tg + " AS \"time\"", err
		}
		return "", err
	default:
		return "", fmt.Errorf("Unknown macro %v", name)
	}
}
