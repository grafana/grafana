package oracle

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOracleMacroEngine_TimeGroupTZ_Oracle19(t *testing.T) {
	engine := newOracleMacroEngine(19)
	
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}
	
	query := &backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}
	
	tests := []struct {
		name     string
		sql      string
		expected string
	}{
		{
			name: "timeGroupTZ with 10 minute interval and UTC timezone - Oracle 19",
			sql:  "SELECT $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') AS Time, COUNT(*) FROM V$SESSION GROUP BY $__timeGroupTZ(LOGON_TIME, 10m, 'UTC')",
			expected: "SELECT FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC') AS Time, COUNT(*) FROM V$SESSION GROUP BY FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC')",
		},
		{
			name: "timeGroupTZ with 1 hour interval and America/New_York timezone - Oracle 19",
			sql:  "SELECT $__timeGroupTZ(CREATED_DATE, 1h, 'America/New_York') AS Time, AVG(VALUE) FROM METRICS GROUP BY $__timeGroupTZ(CREATED_DATE, 1h, 'America/New_York')",
			expected: "SELECT FROM_TZ(CAST(TRUNC(CAST(CREATED_DATE AT TIME ZONE 'America/New_York' AS DATE), 'DD') + NUMTODSINTERVAL(FLOOR(EXTRACT(HOUR FROM CREATED_DATE AT TIME ZONE 'America/New_York') / 1) * 1, 'HOUR') AS TIMESTAMP), 'America/New_York') AS Time, AVG(VALUE) FROM METRICS GROUP BY FROM_TZ(CAST(TRUNC(CAST(CREATED_DATE AT TIME ZONE 'America/New_York' AS DATE), 'DD') + NUMTODSINTERVAL(FLOOR(EXTRACT(HOUR FROM CREATED_DATE AT TIME ZONE 'America/New_York') / 1) * 1, 'HOUR') AS TIMESTAMP), 'America/New_York')",
		},
		{
			name: "timeGroupTZ with 30 second interval - Oracle 19",
			sql:  "SELECT $__timeGroupTZ(EVENT_TIME, 30s) AS Time, COUNT(*) FROM EVENTS GROUP BY $__timeGroupTZ(EVENT_TIME, 30s)",
			expected: "SELECT FROM_TZ(CAST(TRUNC(CAST(EVENT_TIME AT TIME ZONE 'UTC' AS DATE), 'MI') + NUMTODSINTERVAL(FLOOR(EXTRACT(SECOND FROM EVENT_TIME AT TIME ZONE 'UTC') / 30) * 30, 'SECOND') AS TIMESTAMP), 'UTC') AS Time, COUNT(*) FROM EVENTS GROUP BY FROM_TZ(CAST(TRUNC(CAST(EVENT_TIME AT TIME ZONE 'UTC' AS DATE), 'MI') + NUMTODSINTERVAL(FLOOR(EXTRACT(SECOND FROM EVENT_TIME AT TIME ZONE 'UTC') / 30) * 30, 'SECOND') AS TIMESTAMP), 'UTC')",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interpolated, err := engine.Interpolate(query, timeRange, tt.sql)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, interpolated)
		})
	}
}

func TestOracleMacroEngine_TimeGroupTZ_Oracle23(t *testing.T) {
	engine := newOracleMacroEngine(23)
	
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}
	
	query := &backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}
	
	tests := []struct {
		name     string
		sql      string
		expected string
	}{
		{
			name: "timeGroupTZ with 10 minute interval and UTC timezone - Oracle 23",
			sql:  "SELECT $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') AS Time, COUNT(*) FROM V$SESSION GROUP BY $__timeGroupTZ(LOGON_TIME, 10m, 'UTC')",
			expected: "SELECT FROM_TZ(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS TIMESTAMP), 'HH24') + INTERVAL '10' MINUTE * FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10), 'UTC') AS Time, COUNT(*) FROM V$SESSION GROUP BY FROM_TZ(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS TIMESTAMP), 'HH24') + INTERVAL '10' MINUTE * FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10), 'UTC')",
		},
		{
			name: "timeGroupTZ with 1 hour interval - Oracle 23",
			sql:  "SELECT $__timeGroupTZ(CREATED_DATE, 1h) AS Time, AVG(VALUE) FROM METRICS GROUP BY $__timeGroupTZ(CREATED_DATE, 1h)",
			expected: "SELECT FROM_TZ(TRUNC(CAST(CREATED_DATE AT TIME ZONE 'UTC' AS TIMESTAMP), 'DD') + INTERVAL '1' HOUR * FLOOR(EXTRACT(HOUR FROM CREATED_DATE AT TIME ZONE 'UTC') / 1), 'UTC') AS Time, AVG(VALUE) FROM METRICS GROUP BY FROM_TZ(TRUNC(CAST(CREATED_DATE AT TIME ZONE 'UTC' AS TIMESTAMP), 'DD') + INTERVAL '1' HOUR * FLOOR(EXTRACT(HOUR FROM CREATED_DATE AT TIME ZONE 'UTC') / 1), 'UTC')",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interpolated, err := engine.Interpolate(query, timeRange, tt.sql)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, interpolated)
		})
	}
}

func TestOracleMacroEngine_TimeGroupTZ_ErrorCases(t *testing.T) {
	engine := newOracleMacroEngine(19)
	
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}
	
	query := &backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}
	
	tests := []struct {
		name        string
		sql         string
		expectedErr string
	}{
		{
			name:        "missing time column",
			sql:         "SELECT $__timeGroupTZ() AS Time",
			expectedErr: "macro __timeGroupTZ needs time column and interval",
		},
		{
			name:        "missing interval",
			sql:         "SELECT $__timeGroupTZ(LOGON_TIME) AS Time",
			expectedErr: "macro __timeGroupTZ needs time column and interval",
		},
		{
			name:        "invalid interval",
			sql:         "SELECT $__timeGroupTZ(LOGON_TIME, invalid) AS Time",
			expectedErr: "error parsing interval invalid",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := engine.Interpolate(query, timeRange, tt.sql)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.expectedErr)
		})
	}
}

func TestOracleMacroEngine_OtherMacros(t *testing.T) {
	engine := newOracleMacroEngine(19)
	
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}
	
	query := &backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}
	
	tests := []struct {
		name     string
		sql      string
		expected string
	}{
		{
			name:     "timeFilter macro",
			sql:      "SELECT * FROM table WHERE $__timeFilter(time_column)",
			expected: "SELECT * FROM table WHERE time_column BETWEEN TIMESTAMP '2018-03-15 13:00:00' AND TIMESTAMP '2018-03-15 14:00:00'",
		},
		{
			name:     "timeFrom macro",
			sql:      "SELECT * FROM table WHERE time_column >= $__timeFrom()",
			expected: "SELECT * FROM table WHERE time_column >= TIMESTAMP '2018-03-15 13:00:00'",
		},
		{
			name:     "timeTo macro",
			sql:      "SELECT * FROM table WHERE time_column <= $__timeTo()",
			expected: "SELECT * FROM table WHERE time_column <= TIMESTAMP '2018-03-15 14:00:00'",
		},
		{
			name:     "unixEpochFrom macro",
			sql:      "SELECT * FROM table WHERE unix_time >= $__unixEpochFrom()",
			expected: "SELECT * FROM table WHERE unix_time >= 1521118800",
		},
		{
			name:     "unixEpochTo macro",
			sql:      "SELECT * FROM table WHERE unix_time <= $__unixEpochTo()",
			expected: "SELECT * FROM table WHERE unix_time <= 1521122400",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interpolated, err := engine.Interpolate(query, timeRange, tt.sql)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, interpolated)
		})
	}
}

func TestGenerateTimeGroupTZSQL_Oracle19_vs_Oracle23(t *testing.T) {
	// Test that Oracle 19 and 23 generate different SQL
	engine19 := newOracleMacroEngine(19).(*oracleMacroEngine)
	engine23 := newOracleMacroEngine(23).(*oracleMacroEngine)
	
	interval, _ := gtime.ParseInterval("10m")
	
	sql19, err19 := engine19.generateTimeGroupTZSQL("LOGON_TIME", interval, "UTC")
	require.NoError(t, err19)
	
	sql23, err23 := engine23.generateTimeGroupTZSQL("LOGON_TIME", interval, "UTC")
	require.NoError(t, err23)
	
	// Oracle 19 should use NUMTODSINTERVAL
	assert.Contains(t, sql19, "NUMTODSINTERVAL")
	assert.NotContains(t, sql19, "INTERVAL '10' MINUTE")
	
	// Oracle 23 should use INTERVAL arithmetic
	assert.Contains(t, sql23, "INTERVAL '10' MINUTE")
	assert.NotContains(t, sql23, "NUMTODSINTERVAL")
	
	// Both should avoid the problematic INTERVAL DAY TO SECOND arithmetic
	assert.NotContains(t, sql19, "INTERVAL DAY TO SECOND")
	assert.NotContains(t, sql23, "INTERVAL DAY TO SECOND")
}

func TestOracleMacroEngine_ComplexQuery(t *testing.T) {
	engine := newOracleMacroEngine(19)
	
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}
	
	query := &backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}
	
	sql := `
		SELECT 
			$__timeGroupTZ(LOGON_TIME, 10m, 'UTC') AS Time,
			COUNT(*) AS active_sessions,
			AVG(CPU_USAGE) AS avg_cpu
		FROM V$SESSION s
		JOIN V$SESSTAT st ON s.SID = st.SID
		WHERE $__timeFilter(LOGON_TIME)
		  AND st.STATISTIC# = (SELECT STATISTIC# FROM V$STATNAME WHERE NAME = 'CPU used by this session')
		GROUP BY $__timeGroupTZ(LOGON_TIME, 10m, 'UTC')
		ORDER BY $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') ASC
	`
	
	expected := `
		SELECT 
			FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC') AS Time,
			COUNT(*) AS active_sessions,
			AVG(CPU_USAGE) AS avg_cpu
		FROM V$SESSION s
		JOIN V$SESSTAT st ON s.SID = st.SID
		WHERE LOGON_TIME BETWEEN TIMESTAMP '2018-03-15 13:00:00' AND TIMESTAMP '2018-03-15 14:00:00'
		  AND st.STATISTIC# = (SELECT STATISTIC# FROM V$STATNAME WHERE NAME = 'CPU used by this session')
		GROUP BY FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC')
		ORDER BY FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC') ASC
	`
	
	interpolated, err := engine.Interpolate(query, timeRange, sql)
	require.NoError(t, err)
	assert.Equal(t, expected, interpolated)
}

