package mysql

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

//const rsString = `(?:"([^"]*)")`;
const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type MySqlMacroEngine struct {
	TimeRange *tsdb.TimeRange
}

func NewMysqlMacroEngine() tsdb.SqlMacroEngine {
	return &MySqlMacroEngine{}
}

func (m *MySqlMacroEngine) Interpolate(timeRange *tsdb.TimeRange, sql string) (string, error) {
	m.TimeRange = timeRange
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = replaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
		res, err := m.evaluateMacro(groups[1], strings.Split(groups[2], ","))
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

func replaceAllStringSubmatchFunc(re *regexp.Regexp, str string, repl func([]string) string) string {
	result := ""
	lastIndex := 0

	for _, v := range re.FindAllSubmatchIndex([]byte(str), -1) {
		groups := []string{}
		for i := 0; i < len(v); i += 2 {
			groups = append(groups, str[v[i]:v[i+1]])
		}

		result += str[lastIndex:v[0]] + repl(groups)
		lastIndex = v[1]
	}

	return result + str[lastIndex:]
}

func (m *MySqlMacroEngine) evaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__time":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("UNIX_TIMESTAMP(%s) as time_sec", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= FROM_UNIXTIME(%d) AND %s <= FROM_UNIXTIME(%d)", args[0], uint64(m.TimeRange.GetFromAsMsEpoch()/1000), args[0], uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__timeFrom":
		return fmt.Sprintf("FROM_UNIXTIME(%d)", uint64(m.TimeRange.GetFromAsMsEpoch()/1000)), nil
	case "__timeTo":
		return fmt.Sprintf("FROM_UNIXTIME(%d)", uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__timeGroup":
		if len(args) != 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		interval, err := time.ParseDuration(strings.Trim(args[1], `'" `))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		return fmt.Sprintf("cast(cast(UNIX_TIMESTAMP(%s)/(%.0f) as signed)*%.0f as signed)", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__unixEpochFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= %d AND %s <= %d", args[0], uint64(m.TimeRange.GetFromAsMsEpoch()/1000), args[0], uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__unixEpochFrom":
		return fmt.Sprintf("%d", uint64(m.TimeRange.GetFromAsMsEpoch()/1000)), nil
	case "__unixEpochTo":
		return fmt.Sprintf("%d", uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	default:
		return "", fmt.Errorf("Unknown macro %v", name)
	}
}
