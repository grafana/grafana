package azuremonitor

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

const rsIdentifier = `__(timeFilter|timeFrom|timeTo|interval|contains|escapeMulti)`
const sExpr = `\$` + rsIdentifier + `(?:\(([^\)]*)\))?`
const escapeMultiExpr = `\$__escapeMulti\(('.*')\)`

type kqlMacroEngine struct {
	timeRange *tsdb.TimeRange
	query     *tsdb.Query
}

//  Macros:
//   - $__timeFilter() -> timestamp ≥ datetime(2018-06-05T18:09:58.907Z) and timestamp ≤ datetime(2018-06-05T20:09:58.907Z)
//   - $__timeFilter(datetimeColumn) ->  datetimeColumn  ≥ datetime(2018-06-05T18:09:58.907Z) and datetimeColumn ≤ datetime(2018-06-05T20:09:58.907Z)
//   - $__from ->  datetime(2018-06-05T18:09:58.907Z)
//   - $__to -> datetime(2018-06-05T20:09:58.907Z)
//   - $__interval -> 5m
//   - $__contains(col, 'val1','val2') -> col in ('val1', 'val2')
//   - $__escapeMulti('\\vm\eth0\Total','\\vm\eth2\Total') -> @'\\vm\eth0\Total',@'\\vm\eth2\Total'

//KqlInterpolate interpolates macros for Kusto Query Language (KQL) queries
func KqlInterpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, kql string, defaultTimeField ...string) (string, error) {
	engine := kqlMacroEngine{}

	defaultTimeFieldForAllDatasources := "timestamp"
	if len(defaultTimeField) > 0 {
		defaultTimeFieldForAllDatasources = defaultTimeField[0]
	}
	return engine.Interpolate(query, timeRange, kql, defaultTimeFieldForAllDatasources)
}

func (m *kqlMacroEngine) Interpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, kql string, defaultTimeField string) (string, error) {
	m.timeRange = timeRange
	m.query = query
	rExp, _ := regexp.Compile(sExpr)
	escapeMultiRegex, _ := regexp.Compile(escapeMultiExpr)

	var macroError error

	//First pass for the escapeMulti macro
	kql = m.ReplaceAllStringSubmatchFunc(escapeMultiRegex, kql, func(groups []string) string {
		args := []string{}

		if len(groups) > 1 {
			args = strings.Split(groups[1], "','")
		}

		expr := strings.Join(args, "', @'")
		return fmt.Sprintf("@%s", expr)
	})

	//second pass for all the other macros
	kql = m.ReplaceAllStringSubmatchFunc(rExp, kql, func(groups []string) string {
		args := []string{}
		if len(groups) > 2 {
			args = strings.Split(groups[2], ",")
		}

		for i, arg := range args {
			args[i] = strings.Trim(arg, " ")
		}
		res, err := m.evaluateMacro(groups[1], defaultTimeField, args)
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

func (m *kqlMacroEngine) evaluateMacro(name string, defaultTimeField string, args []string) (string, error) {
	switch name {
	case "timeFilter":
		timeColumn := defaultTimeField
		if len(args) > 0 && args[0] != "" {
			timeColumn = args[0]
		}
		return fmt.Sprintf("['%s'] >= datetime('%s') and ['%s'] <= datetime('%s')", timeColumn, m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339), timeColumn, m.timeRange.GetToAsTimeUTC().Format(time.RFC3339)), nil
	case "timeFrom", "__from":
		return fmt.Sprintf("datetime('%s')", m.timeRange.GetFromAsTimeUTC().Format(time.RFC3339)), nil
	case "timeTo", "__to":
		return fmt.Sprintf("datetime('%s')", m.timeRange.GetToAsTimeUTC().Format(time.RFC3339)), nil
	case "interval":
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
	case "contains":
		if len(args) < 2 || args[0] == "" || args[1] == "" {
			return "", fmt.Errorf("macro %v needs colName and variableSet", name)
		}

		if args[1] == "all" {
			return "1 == 1", nil
		}

		expression := strings.Join(args[1:], ",")
		return fmt.Sprintf("['%s'] in (%s)", args[0], expression), nil
	case "escapeMulti":
		return "", fmt.Errorf("escapeMulti macro not formatted correctly")
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
