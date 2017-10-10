package postgres

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/tsdb"
)

//const rsString = `(?:"([^"]*)")`;
const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type SqlMacroEngine interface {
	Interpolate(sql string) (string, error)
}

type PostgresMacroEngine struct {
	TimeRange *tsdb.TimeRange
}

func NewPostgresMacroEngine(timeRange *tsdb.TimeRange) SqlMacroEngine {
	return &PostgresMacroEngine{
		TimeRange: timeRange,
	}
}

func (m *PostgresMacroEngine) Interpolate(sql string) (string, error) {
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = ReplaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
		res, err := m.EvaluateMacro(groups[1], strings.Split(groups[2], ","))
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

func ReplaceAllStringSubmatchFunc(re *regexp.Regexp, str string, repl func([]string) string) string {
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

func (m *PostgresMacroEngine) EvaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__time":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s AS \"time\"", args[0]), nil
	case "__timeSec":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("extract(epoch from %s) as \"time\"", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s >= to_timestamp(%d) AND %s <= to_timestamp(%d)", args[0], uint64(m.TimeRange.GetFromAsMsEpoch()/1000), args[0], uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__timeFrom":
		return fmt.Sprintf("to_timestamp(%d)", uint64(m.TimeRange.GetFromAsMsEpoch()/1000)), nil
	case "__timeTo":
		return fmt.Sprintf("to_timestamp(%d)", uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		return fmt.Sprintf("(extract(epoch from \"%s\")/extract(epoch from %s::interval))::int", args[0], args[1]), nil
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
