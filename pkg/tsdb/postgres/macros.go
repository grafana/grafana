package postgres

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

//const rsString = `(?:"([^"]*)")`;
const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type PostgresMacroEngine struct {
	TimeRange *tsdb.TimeRange
	Query     *tsdb.Query
}

func NewPostgresMacroEngine() tsdb.SqlMacroEngine {
	return &PostgresMacroEngine{}
}

func (m *PostgresMacroEngine) Interpolate(query *tsdb.Query, timeRange *tsdb.TimeRange, sql string) (string, error) {
	m.TimeRange = timeRange
	m.Query = query
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = replaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
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

func (m *PostgresMacroEngine) evaluateMacro(name string, args []string) (string, error) {
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
		// dont use to_timestamp in this macro for redshift compatibility #9566
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("extract(epoch from %s) BETWEEN %d AND %d", args[0], uint64(m.TimeRange.GetFromAsMsEpoch()/1000), uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__timeFrom":
		return fmt.Sprintf("to_timestamp(%d)", uint64(m.TimeRange.GetFromAsMsEpoch()/1000)), nil
	case "__timeTo":
		return fmt.Sprintf("to_timestamp(%d)", uint64(m.TimeRange.GetToAsMsEpoch()/1000)), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval and optional fill value", name)
		}
		interval, err := time.ParseDuration(strings.Trim(args[1], `'`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			m.Query.Model.Set("fill", true)
			m.Query.Model.Set("fillInterval", interval.Seconds())
			if args[2] == "NULL" {
				m.Query.Model.Set("fillNull", true)
			} else {
				floatVal, err := strconv.ParseFloat(args[2], 64)
				if err != nil {
					return "", fmt.Errorf("error parsing fill value %v", args[2])
				}
				m.Query.Model.Set("fillValue", floatVal)
			}
		}
		return fmt.Sprintf("(extract(epoch from %s)/%v)::bigint*%v AS time", args[0], interval.Seconds(), interval.Seconds()), nil
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
