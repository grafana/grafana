package mysql

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

var restrictedRegExp = regexp.MustCompile(`(?im)([\s]*show[\s]+grants|[\s,]session_user\([^\)]*\)|[\s,]current_user(\([^\)]*\))?|[\s,]system_user\([^\)]*\)|[\s,]user\([^\)]*\))([\s,;]|$)`)

type mySqlMacroEngine struct {
	*sqleng.SqlMacroEngineBase
	timeRange *tsdb.TimeRange
	query     *tsdb.Query
	logger    log.Logger
}

func newMysqlMacroEngine(logger log.Logger) sqleng.SqlMacroEngine {
	return &mySqlMacroEngine{SqlMacroEngineBase: sqleng.NewSqlMacroEngineBase(), logger: logger}
}

func (m *mySqlMacroEngine) Interpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, sql string) (string, error) {
	m.timeRange = timeRange
	m.query = query

	matches := restrictedRegExp.FindAllStringSubmatch(sql, 1)
	if len(matches) > 0 {
		m.logger.Error("show grants, session_user(), current_user(), system_user() or user() not allowed in query")
		return "", errors.New("Invalid query. Inspect Grafana server log for details")
	}

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

func (m *mySqlMacroEngine) evaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__timeEpoch", "__time":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("UNIX_TIMESTAMP(%s) as time_sec", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}

		return fmt.Sprintf("%s BETWEEN FROM_UNIXTIME(%d) AND FROM_UNIXTIME(%d)", args[0], m.timeRange.GetFromAsSecondsEpoch(), m.timeRange.GetToAsSecondsEpoch()), nil
	case "__timeFrom":
		return fmt.Sprintf("FROM_UNIXTIME(%d)", m.timeRange.GetFromAsSecondsEpoch()), nil
	case "__timeTo":
		return fmt.Sprintf("FROM_UNIXTIME(%d)", m.timeRange.GetToAsSecondsEpoch()), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'"`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := sqleng.SetupFillmode(m.query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("UNIX_TIMESTAMP(%s) DIV %.0f * %.0f", args[0], interval.Seconds(), interval.Seconds()), nil
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
		return fmt.Sprintf("%s DIV %v * %v", args[0], interval.Seconds(), interval.Seconds()), nil
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
