package mssql

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/tsdb"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type msSqlMacroEngine struct {
	*tsdb.SqlMacroEngineBase
	timeRange *tsdb.TimeRange
	query     *tsdb.Query
}

func newMssqlMacroEngine() tsdb.SqlMacroEngine {
	return &msSqlMacroEngine{SqlMacroEngineBase: tsdb.NewSqlMacroEngineBase()}
}

func (m *msSqlMacroEngine) Interpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, sql string) (string, error) {
	m.timeRange = timeRange
	m.query = query
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = m.ReplaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
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

func (m *msSqlMacroEngine) evaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__time":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s AS time", args[0]), nil
	case "__timeEpoch":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("DATEDIFF(second, '1970-01-01', %s) AS time", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}

		return fmt.Sprintf("%s BETWEEN '%s' AND '%s'", args[0], m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339), m.timeRange.GetToAsTimeUTC().Format(time.RFC3339)), nil
	case "__timeFrom":
		return fmt.Sprintf("'%s'", m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339)), nil
	case "__timeTo":
		return fmt.Sprintf("'%s'", m.timeRange.GetToAsTimeUTC().Format(time.RFC3339)), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'"`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := tsdb.SetupFillmode(m.query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("FLOOR(DATEDIFF(second, '1970-01-01', %s)/%.0f)*%.0f", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__timeGroupAlias":
		tg, err := m.evaluateMacro("__timeGroup", args)
		if err == nil {
			return tg + " AS [time]", err
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
			err := tsdb.SetupFillmode(m.query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("FLOOR(%s/%v)*%v", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__unixEpochGroupAlias":
		tg, err := m.evaluateMacro("__unixEpochGroup", args)
		if err == nil {
			return tg + " AS [time]", err
		}
		return "", err
	default:
		return "", fmt.Errorf("Unknown macro %v", name)
	}
}
