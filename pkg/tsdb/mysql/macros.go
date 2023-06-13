package mysql

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

var restrictedRegExp = regexp.MustCompile(`(?im)([\s]*show[\s]+grants|[\s,]session_user\([^\)]*\)|[\s,]current_user(\([^\)]*\))?|[\s,]system_user\([^\)]*\)|[\s,]user\([^\)]*\))([\s,;]|$)`)

type mySQLMacroEngine struct {
	*sqleng.SQLMacroEngineBase
	logger    log.Logger
	userError string
}

func newMysqlMacroEngine(logger log.Logger, cfg *setting.Cfg) sqleng.SQLMacroEngine {
	return &mySQLMacroEngine{
		SQLMacroEngineBase: sqleng.NewSQLMacroEngineBase(),
		logger:             logger,
		userError:          cfg.UserFacingDefaultError,
	}
}

func (m *mySQLMacroEngine) Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error) {
	matches := restrictedRegExp.FindAllStringSubmatch(sql, 1)
	if len(matches) > 0 {
		m.logger.Error("show grants, session_user(), current_user(), system_user() or user() not allowed in query")
		return "", fmt.Errorf("invalid query - %s", m.userError)
	}

	// TODO: Handle error
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = m.ReplaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
		args := strings.Split(groups[2], ",")
		for i, arg := range args {
			args[i] = strings.Trim(arg, " ")
		}
		res, err := m.evaluateMacro(timeRange, query, groups[1], args)
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

func (m *mySQLMacroEngine) evaluateMacro(timeRange backend.TimeRange, query *backend.DataQuery, name string, args []string) (string, error) {
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
		if timeRange.From.UTC().Unix() < 0 {
			return fmt.Sprintf("%s BETWEEN DATE_ADD(FROM_UNIXTIME(0), INTERVAL %d SECOND) AND FROM_UNIXTIME(%d)", args[0], timeRange.From.UTC().Unix(), timeRange.To.UTC().Unix()), nil
		}
		return fmt.Sprintf("%s BETWEEN FROM_UNIXTIME(%d) AND FROM_UNIXTIME(%d)", args[0], timeRange.From.UTC().Unix(), timeRange.To.UTC().Unix()), nil
	case "__timeFrom":
		return fmt.Sprintf("FROM_UNIXTIME(%d)", timeRange.From.UTC().Unix()), nil
	case "__timeTo":
		return fmt.Sprintf("FROM_UNIXTIME(%d)", timeRange.To.UTC().Unix()), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'"`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := sqleng.SetupFillmode(query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("UNIX_TIMESTAMP(%s) DIV %.0f * %.0f", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__timeGroupAlias":
		tg, err := m.evaluateMacro(timeRange, query, "__timeGroup", args)
		if err == nil {
			return tg + " AS \"time\"", nil
		}
		return "", err
	case "__unixEpochFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= %d AND %s <= %d", args[0], timeRange.From.UTC().Unix(), args[0], timeRange.To.UTC().Unix()), nil
	case "__unixEpochNanoFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= %d AND %s <= %d", args[0], timeRange.From.UTC().UnixNano(), args[0], timeRange.To.UTC().UnixNano()), nil
	case "__unixEpochNanoFrom":
		return fmt.Sprintf("%d", timeRange.From.UTC().UnixNano()), nil
	case "__unixEpochNanoTo":
		return fmt.Sprintf("%d", timeRange.To.UTC().UnixNano()), nil
	case "__unixEpochGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval and optional fill value", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := sqleng.SetupFillmode(query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("%s DIV %v * %v", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__unixEpochGroupAlias":
		tg, err := m.evaluateMacro(timeRange, query, "__unixEpochGroup", args)
		if err == nil {
			return tg + " AS \"time\"", nil
		}
		return "", err
	default:
		return "", fmt.Errorf("unknown macro %v", name)
	}
}
