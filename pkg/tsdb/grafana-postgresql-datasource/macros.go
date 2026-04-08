package postgres

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

// isDollarTagChar reports whether b is valid inside a PostgreSQL dollar-quote tag
// (letters and digits only; underscore is also allowed per identifier rules).
func isDollarTagChar(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '_'
}

// consumeQuoted copies a single-quoted or double-quoted region (delimited by q)
// from sql[i:] into out, handling ” (or "") doubled-quote escapes.
// i must point at the opening quote. Returns the new position after the closing quote.
func consumeQuoted(sql string, i, n int, q byte, out *strings.Builder) int {
	out.WriteByte(q)
	i++
	for i < n {
		if sql[i] == q {
			out.WriteByte(sql[i])
			i++
			if i < n && sql[i] == q {
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
	return i
}

// consumeDollarQuoted copies a dollar-quoted region from sql[i:] into out.
// i must point at the start of the opening delimiter (e.g. "$$" or "$tag$").
// closing is the full closing delimiter string. Returns the new position.
func consumeDollarQuoted(sql string, i int, closing string, out *strings.Builder) int {
	out.WriteString(closing)
	i += len(closing)
	n := len(sql)
	for i < n {
		if strings.HasPrefix(sql[i:], closing) {
			out.WriteString(closing)
			i += len(closing)
			break
		}
		out.WriteByte(sql[i])
		i++
	}
	return i
}

// stripSQLComments removes SQL line comments (--) and block comments (/* */)
// from the query string. It is quote-aware: comment sequences inside single-quoted
// string literals, double-quoted identifiers, and dollar-quoted strings are
// preserved verbatim.
func stripSQLComments(sql string) string {
	var out strings.Builder
	out.Grow(len(sql))
	i := 0
	n := len(sql)
	for i < n {
		switch {
		case sql[i] == '$':
			// Try to detect a PostgreSQL dollar-quoted string: $$...$$ or $tag$...$tag$.
			// Tags follow identifier rules ([A-Za-z_][A-Za-z0-9_]*) or are empty.
			// Grafana macros ($__name(...)) are distinguished by ending with '(' not '$'.
			j := i + 1
			if j < n && sql[j] == '$' {
				i = consumeDollarQuoted(sql, i, "$$", &out)
			} else if j < n && isDollarTagChar(sql[j]) && (sql[j] < '0' || sql[j] > '9') {
				// Possible non-empty tag: must start with letter or underscore.
				k := j + 1
				for k < n && isDollarTagChar(sql[k]) {
					k++
				}
				if k < n && sql[k] == '$' {
					i = consumeDollarQuoted(sql, i, sql[i:k+1], &out)
				} else {
					// Not a dollar-quote (e.g. a Grafana macro $__timeFrom()).
					out.WriteByte(sql[i])
					i++
				}
			} else {
				// Not a dollar-quote (e.g. $1 positional parameter).
				out.WriteByte(sql[i])
				i++
			}
		case sql[i] == '\'':
			i = consumeQuoted(sql, i, n, '\'', &out)
		case sql[i] == '"':
			i = consumeQuoted(sql, i, n, '"', &out)
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

type postgresMacroEngine struct {
	*sqleng.SQLMacroEngineBase
	timescaledb bool
}

func newPostgresMacroEngine(timescaledb bool) sqleng.SQLMacroEngine {
	return &postgresMacroEngine{
		SQLMacroEngineBase: sqleng.NewSQLMacroEngineBase(),
		timescaledb:        timescaledb,
	}
}

func (m *postgresMacroEngine) Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error) {
	// Strip SQL comments before macro interpolation so that only macros present
	// in executable SQL are evaluated.
	sql = stripSQLComments(sql)

	// TODO: Handle error
	rExp, _ := regexp.Compile(sExpr)
	var macroError error

	sql = m.ReplaceAllStringSubmatchFunc(rExp, sql, func(groups []string) string {
		// detect if $__timeGroup is supposed to add AS time for pre 5.3 compatibility
		// if there is a ',' directly after the macro call $__timeGroup is probably used
		// in the old way. Inside window function ORDER BY $__timeGroup will be followed
		// by ')'
		if groups[1] == "__timeGroup" {
			if index := strings.Index(sql, groups[0]); index >= 0 {
				index += len(groups[0])
				// check for character after macro expression
				if len(sql) > index && sql[index] == ',' {
					groups[1] = "__timeGroupAlias"
				}
			}
		}

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

//nolint:gocyclo
func (m *postgresMacroEngine) evaluateMacro(timeRange backend.TimeRange, query *backend.DataQuery, name string, args []string) (string, error) {
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
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}

		return fmt.Sprintf("%s BETWEEN '%s' AND '%s'", args[0], timeRange.From.UTC().Format(time.RFC3339Nano), timeRange.To.UTC().Format(time.RFC3339Nano)), nil
	case "__timeFrom":
		return fmt.Sprintf("'%s'", timeRange.From.UTC().Format(time.RFC3339Nano)), nil
	case "__timeTo":
		return fmt.Sprintf("'%s'", timeRange.To.UTC().Format(time.RFC3339Nano)), nil
	case "__timeGroup":
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

		if m.timescaledb {
			return fmt.Sprintf("time_bucket('%.3fs',%s)", interval.Seconds(), args[0]), nil
		}

		return fmt.Sprintf(
			"floor(extract(epoch from %s)/%v)*%v", args[0],
			interval.Seconds(),
			interval.Seconds(),
		), nil
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
		return fmt.Sprintf("floor((%s)/%v)*%v", args[0], interval.Seconds(), interval.Seconds()), nil
	case "__unixEpochGroupAlias":
		tg, err := m.evaluateMacro(timeRange, query, "__unixEpochGroup", args)
		if err == nil {
			return tg + " AS \"time\"", nil
		}
		return "", err
	default:
		return "", fmt.Errorf("unknown macro %q", name)
	}
}
