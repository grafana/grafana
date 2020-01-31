package azuremonitor

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `(?:\(([^\)]*)\))?`

type kqlMacroEngine struct {
	timeRange *tsdb.TimeRange
	query     *tsdb.Query
}

func KqlInterpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, kql string) (string, error) {
	engine := kqlMacroEngine{}
	return engine.Interpolate(query, timeRange, kql)
}

func (m *kqlMacroEngine) Interpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, kql string) (string, error) {
	m.timeRange = timeRange
	m.query = query
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	kql = m.ReplaceAllStringSubmatchFunc(rExp, kql, func(groups []string) string {
		args := []string{}
		if len(groups) > 2 {
			args = strings.Split(groups[2], ",")
		}

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

	return kql, nil
}

func (m *kqlMacroEngine) evaluateMacro(name string, args []string) (string, error) {
	switch name {
	case "__timeFilter":
		timeColumn := "timestamp"
		if len(args) > 0 && args[0] != "" {
			timeColumn = args[0]
		}
		return fmt.Sprintf("['%s'] >= datetime('%s') and ['%s'] <= datetime('%s')", timeColumn, m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339), timeColumn, m.timeRange.GetToAsTimeUTC().Format(time.RFC3339)), nil
	case "__timeFrom", "__from":
		return fmt.Sprintf("datetime('%s')", m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339)), nil
	case "__timeTo", "__to":
		return fmt.Sprintf("datetime('%s')", m.timeRange.GetToAsTimeUTC().Format(time.RFC3339)), nil
	case "__interval":
		var interval time.Duration
		if m.query.IntervalMs == 0 {
			to := m.timeRange.MustGetTo().UnixNano()
			from := m.timeRange.MustGetFrom().UnixNano()
			// default to "100 datapoints" if nothing in the query is more specific
			defaultInterval := time.Duration((to - from) / 60)
			var err error
			interval, err = tsdb.GetIntervalFrom(m.query.DataSource, m.query.Model, defaultInterval)
			if err != nil {
				azlog.Warn("Unable to get interval from query", "datasource", m.query.DataSource, "model", m.query.Model)
				interval = defaultInterval
			}
		} else {
			interval = time.Millisecond * time.Duration(m.query.IntervalMs)
		}
		return fmt.Sprintf("%dms", int(interval/time.Millisecond)), nil
	case "__contains":
		if len(args) < 2 || args[0] == "" || args[1] == "" {
			return "", fmt.Errorf("macro %v needs colName and variableSet", name)
		}

		if args[1] == "all" {
			return "1 == 1", nil
		}

		return fmt.Sprintf("['%s'] in ('%s')", args[0], args[1]), nil
	default:
		return "", fmt.Errorf("Unknown macro %v", name)
	}
}

func (m *kqlMacroEngine) ReplaceAllStringSubmatchFunc(re *regexp.Regexp, str string, repl func([]string) string) string {
	result := ""
	lastIndex := 0

	for _, v := range re.FindAllSubmatchIndex([]byte(str), -1) {
		groups := []string{}
		for i := 0; i < len(v); i += 2 {
			if v[i] < 0 {
				groups = append(groups, "")
			} else {
				groups = append(groups, str[v[i]:v[i+1]])
			}
		}

		result += str[lastIndex:v[0]] + repl(groups)
		lastIndex = v[1]
	}

	return result + str[lastIndex:]
}
