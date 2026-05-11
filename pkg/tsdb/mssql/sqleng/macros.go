package sqleng

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

// stripSQLComments removes SQL line comments (--) and block comments (/* */)
// from the query string. It is quote-aware: comment sequences inside single-quoted
// string literals, double-quoted identifiers, and T-SQL bracket-quoted identifiers
// are preserved verbatim.
func stripSQLComments(sql string) string {
	var out strings.Builder
	out.Grow(len(sql))
	i := 0
	n := len(sql)
	for i < n {
		switch {
		case sql[i] == '\'':
			// Single-quoted string literal. Pass verbatim; '' is the escape sequence.
			out.WriteByte(sql[i])
			i++
			for i < n {
				if sql[i] == '\'' {
					out.WriteByte(sql[i])
					i++
					if i < n && sql[i] == '\'' {
						// Doubled-quote escape: '' inside a string literal.
						out.WriteByte(sql[i])
						i++
					} else {
						break
					}
				} else {
					out.WriteByte(sql[i])
					i++
				}
			}
		case sql[i] == '"':
			// Double-quoted identifier. Pass verbatim; "" is the escape sequence.
			out.WriteByte(sql[i])
			i++
			for i < n {
				if sql[i] == '"' {
					out.WriteByte(sql[i])
					i++
					if i < n && sql[i] == '"' {
						out.WriteByte(sql[i])
						i++
					} else {
						break
					}
				} else {
					out.WriteByte(sql[i])
					i++
				}
			}
		case sql[i] == '[':
			// T-SQL bracket-quoted identifier. Pass verbatim; ]] is the escape sequence.
			out.WriteByte(sql[i])
			i++
			for i < n {
				if sql[i] == ']' {
					out.WriteByte(sql[i])
					i++
					if i < n && sql[i] == ']' {
						// Doubled-bracket escape: ]] inside a bracket identifier.
						out.WriteByte(sql[i])
						i++
					} else {
						break
					}
				} else {
					out.WriteByte(sql[i])
					i++
				}
			}
		case i+1 < n && sql[i] == '/' && sql[i+1] == '*':
			// Block comment: skip to closing */.
			i += 2
			for i+1 < n {
				if sql[i] == '*' && sql[i+1] == '/' {
					i += 2
					break
				}
				i++
			}
		case i+1 < n && sql[i] == '-' && sql[i+1] == '-':
			// Line comment: skip to end of line (newline is preserved).
			for i < n && sql[i] != '\n' {
				i++
			}
		default:
			out.WriteByte(sql[i])
			i++
		}
	}
	return out.String()
}

type msSQLMacroEngine struct {
	*SQLMacroEngineBase
}

func newMssqlMacroEngine() SQLMacroEngine {
	return &msSQLMacroEngine{SQLMacroEngineBase: NewSQLMacroEngineBase()}
}

func (m *msSQLMacroEngine) Interpolate(query *backend.DataQuery, timeRange backend.TimeRange,
	sql string) (string, error) {
	// Strip SQL comments before macro interpolation so that only macros present
	// in executable SQL are evaluated.
	sql = stripSQLComments(sql)

	// TODO: Return any error
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

func (m *msSQLMacroEngine) evaluateMacro(timeRange backend.TimeRange, query *backend.DataQuery, name string, args []string) (string, error) {
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

		return fmt.Sprintf("%s BETWEEN '%s' AND '%s'", args[0], timeRange.From.UTC().Format(time.RFC3339), timeRange.To.UTC().Format(time.RFC3339)), nil
	case "__timeFrom":
		return fmt.Sprintf("'%s'", timeRange.From.UTC().Format(time.RFC3339)), nil
	case "__timeTo":
		return fmt.Sprintf("'%s'", timeRange.To.UTC().Format(time.RFC3339)), nil
	case "__timeGroup":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'"`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		if len(args) == 3 {
			err := SetupFillmode(query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("FLOOR(DATEDIFF(second, '1970-01-01', %s)/%.0f)*%.0f", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__timeGroupAlias":
		tg, err := m.evaluateMacro(timeRange, query, "__timeGroup", args)
		if err == nil {
			return tg + " AS [time]", nil
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
			err := SetupFillmode(query, interval, args[2])
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf("FLOOR(%s/%v)*%v", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__unixEpochGroupAlias":
		tg, err := m.evaluateMacro(timeRange, query, "__unixEpochGroup", args)
		if err == nil {
			return tg + " AS [time]", nil
		}
		return "", err
	default:
		return "", fmt.Errorf("unknown macro %q", name)
	}
}
