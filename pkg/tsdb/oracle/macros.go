package oracle

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/tsdb/oracle/sqleng"
)

const rsIdentifier = `([_a-zA-Z0-9]+)`
const sExpr = `\$` + rsIdentifier + `\(([^\)]*)\)`

type oracleMacroEngine struct {
	*sqleng.SQLMacroEngineBase
	oracleVersion int // 19, 21, 23, etc.
}

func newOracleMacroEngine(oracleVersion int) sqleng.SQLMacroEngine {
	return &oracleMacroEngine{
		SQLMacroEngineBase: sqleng.NewSQLMacroEngineBase(),
		oracleVersion:      oracleVersion,
	}
}

func (m *oracleMacroEngine) Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error) {
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

func (m *oracleMacroEngine) evaluateMacro(timeRange backend.TimeRange, query *backend.DataQuery, name string, args []string) (string, error) {
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
		return fmt.Sprintf("EXTRACT(EPOCH FROM %s) AS time", args[0]), nil
	case "__timeFilter":
		if len(args) == 0 {
			return "", fmt.Errorf("missing time column argument for macro %v", name)
		}
		return fmt.Sprintf("%s BETWEEN TIMESTAMP '%s' AND TIMESTAMP '%s'", 
			args[0], 
			timeRange.From.UTC().Format("2006-01-02 15:04:05"), 
			timeRange.To.UTC().Format("2006-01-02 15:04:05")), nil
	case "__timeFrom":
		return fmt.Sprintf("TIMESTAMP '%s'", timeRange.From.UTC().Format("2006-01-02 15:04:05")), nil
	case "__timeTo":
		return fmt.Sprintf("TIMESTAMP '%s'", timeRange.To.UTC().Format("2006-01-02 15:04:05")), nil
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
		
		// Use TRUNC with DATE arithmetic for Oracle time grouping
		return fmt.Sprintf(
			"TRUNC(%s, 'MI') + INTERVAL '%d' MINUTE * FLOOR(EXTRACT(MINUTE FROM %s) / %d)",
			args[0], 
			int(interval.Minutes()),
			args[0],
			int(interval.Minutes()),
		), nil
	case "__timeGroupTZ":
		if len(args) < 2 {
			return "", fmt.Errorf("macro %v needs time column and interval", name)
		}
		interval, err := gtime.ParseInterval(strings.Trim(args[1], `'"`))
		if err != nil {
			return "", fmt.Errorf("error parsing interval %v", args[1])
		}
		
		timezone := "UTC"
		if len(args) >= 3 && args[2] != "" {
			timezone = strings.Trim(args[2], `'"`)
		}
		
		if len(args) == 4 {
			err := sqleng.SetupFillmode(query, interval, args[3])
			if err != nil {
				return "", err
			}
		}
		
		return m.generateTimeGroupTZSQL(args[0], interval, timezone)
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
	case "__unixEpochFrom":
		return fmt.Sprintf("%d", timeRange.From.UTC().Unix()), nil
	case "__unixEpochTo":
		return fmt.Sprintf("%d", timeRange.To.UTC().Unix()), nil
	default:
		return "", fmt.Errorf("unknown macro %v", name)
	}
}

// generateTimeGroupTZSQL generates timezone-aware time grouping SQL that works across Oracle versions
func (m *oracleMacroEngine) generateTimeGroupTZSQL(timeColumn string, interval time.Duration, timezone string) (string, error) {
	intervalSeconds := int64(interval.Seconds())
	
	// For Oracle 19, we need to avoid INTERVAL DAY TO SECOND arithmetic that causes ORA-00932
	// Instead, use NUMTODSINTERVAL and explicit numeric calculations
	if m.oracleVersion < 21 {
		// Oracle 19 compatible version - avoid INTERVAL arithmetic
		switch {
		case intervalSeconds < 60: // seconds
			return fmt.Sprintf(
				"FROM_TZ(CAST(TRUNC(CAST(%s AT TIME ZONE '%s' AS DATE), 'MI') + NUMTODSINTERVAL(FLOOR(EXTRACT(SECOND FROM %s AT TIME ZONE '%s') / %d) * %d, 'SECOND') AS TIMESTAMP), '%s')",
				timeColumn, timezone, timeColumn, timezone, intervalSeconds, intervalSeconds, timezone,
			), nil
		case intervalSeconds < 3600: // minutes
			minutes := intervalSeconds / 60
			return fmt.Sprintf(
				"FROM_TZ(CAST(TRUNC(CAST(%s AT TIME ZONE '%s' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM %s AT TIME ZONE '%s') / %d) * %d, 'MINUTE') AS TIMESTAMP), '%s')",
				timeColumn, timezone, timeColumn, timezone, minutes, minutes, timezone,
			), nil
		case intervalSeconds < 86400: // hours
			hours := intervalSeconds / 3600
			return fmt.Sprintf(
				"FROM_TZ(CAST(TRUNC(CAST(%s AT TIME ZONE '%s' AS DATE), 'DD') + NUMTODSINTERVAL(FLOOR(EXTRACT(HOUR FROM %s AT TIME ZONE '%s') / %d) * %d, 'HOUR') AS TIMESTAMP), '%s')",
				timeColumn, timezone, timeColumn, timezone, hours, hours, timezone,
			), nil
		default: // days
			days := intervalSeconds / 86400
			return fmt.Sprintf(
				"FROM_TZ(CAST(TRUNC(CAST(%s AT TIME ZONE '%s' AS DATE)) + NUMTODSINTERVAL(FLOOR((CAST(%s AT TIME ZONE '%s' AS DATE) - TRUNC(CAST(%s AT TIME ZONE '%s' AS DATE))) / %d) * %d, 'DAY') AS TIMESTAMP), '%s')",
				timeColumn, timezone, timeColumn, timezone, timeColumn, timezone, days, days, timezone,
			), nil
		}
	} else {
		// Oracle 21+ version - can use INTERVAL arithmetic more freely
		switch {
		case intervalSeconds < 60: // seconds
			return fmt.Sprintf(
				"FROM_TZ(TRUNC(CAST(%s AT TIME ZONE '%s' AS TIMESTAMP), 'MI') + INTERVAL '%d' SECOND * FLOOR(EXTRACT(SECOND FROM %s AT TIME ZONE '%s') / %d), '%s')",
				timeColumn, timezone, intervalSeconds, timeColumn, timezone, intervalSeconds, timezone,
			), nil
		case intervalSeconds < 3600: // minutes
			minutes := intervalSeconds / 60
			return fmt.Sprintf(
				"FROM_TZ(TRUNC(CAST(%s AT TIME ZONE '%s' AS TIMESTAMP), 'HH24') + INTERVAL '%d' MINUTE * FLOOR(EXTRACT(MINUTE FROM %s AT TIME ZONE '%s') / %d), '%s')",
				timeColumn, timezone, minutes, timeColumn, timezone, minutes, timezone,
			), nil
		case intervalSeconds < 86400: // hours
			hours := intervalSeconds / 3600
			return fmt.Sprintf(
				"FROM_TZ(TRUNC(CAST(%s AT TIME ZONE '%s' AS TIMESTAMP), 'DD') + INTERVAL '%d' HOUR * FLOOR(EXTRACT(HOUR FROM %s AT TIME ZONE '%s') / %d), '%s')",
				timeColumn, timezone, hours, timeColumn, timezone, hours, timezone,
			), nil
		default: // days
			days := intervalSeconds / 86400
			return fmt.Sprintf(
				"FROM_TZ(TRUNC(CAST(%s AT TIME ZONE '%s' AS TIMESTAMP)) + INTERVAL '%d' DAY * FLOOR((CAST(%s AT TIME ZONE '%s' AS DATE) - TRUNC(CAST(%s AT TIME ZONE '%s' AS DATE))) / %d), '%s')",
				timeColumn, timezone, days, timeColumn, timezone, timeColumn, timezone, days, timezone,
			), nil
		}
	}
}

