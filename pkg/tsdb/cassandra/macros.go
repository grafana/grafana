package cassandra

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/tsdb"
	"strings"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type CqlMacroEngine interface {
	Interpolate(sql string) (string, error)
}

type CassandraMacroEngine struct {
	TimeRange *tsdb.TimeRange
}

func NewCassandraMacroEngine(timeRange *tsdb.TimeRange) CqlMacroEngine {
	return &CassandraMacroEngine{
		TimeRange: timeRange,
	}
}

func (m *CassandraMacroEngine) Interpolate(cql string) (string, error) {
	cql = strings.Replace(cql, "\u00A0", "\x20", -1) //nbsp to space

	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	cql = ReplaceAllStringSubmatchFunc(rExp, cql, func(groups []string) string {
		res, err := m.EvaluateMacro(groups[1], groups[2:])
		if err != nil && macroError == nil {
			macroError = err
			return "macro_error()"
		}
		return res
	})

	if macroError != nil {
		return "", macroError
	}

	return cql, nil
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

func (m *CassandraMacroEngine) EvaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__time":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("toUnixTimestamp(%s) as time_ms", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s > %d AND %s <= %d", args[0], uint64(m.TimeRange.GetFromAsMsEpoch()), args[0], uint64(m.TimeRange.GetToAsMsEpoch())), nil
	default:
		return "", fmt.Errorf("unknown macro %v", name)
	}
}
