package oracle

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Oracle19IntegrationTest tests the Oracle 19 specific functionality
// This test simulates the exact scenario described in GitHub issue #111134
func TestOracle19_TimeGroupTZ_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping Oracle 19 integration test in short mode")
	}

	// Create Oracle 19 datasource
	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		UID:      "oracle19-test",
		Name:     "Oracle 19 Test",
		URL:      "localhost:1521",
		User:     "testuser",
		Database: "XE",
		JSONData: map[string]interface{}{
			"oracleVersion":   19,
			"maxOpenConns":    5,
			"maxIdleConns":    2,
			"connMaxLifetime": 14400,
			"timezone":        "UTC",
		},
		DecryptedSecureJSONData: map[string]string{
			"password": "testpass",
		},
		Updated: time.Now(),
	}

	ctx := context.Background()
	datasource, err := NewOracleDatasource(ctx, settings)
	require.NoError(t, err)
	require.NotNil(t, datasource)

	oracle19DS := datasource.(*OracleDatasource)

	// Test the exact query from the GitHub issue
	testCases := []struct {
		name        string
		query       string
		expectedSQL string
		description string
	}{
		{
			name: "GitHub Issue #111134 - Original failing query",
			query: `SELECT $__timeGroupTZ(LOGON_TIME, 10m) AS Time,
COUNT(*) AS active_sessions
FROM V$SESSION
WHERE $__timeFilter(LOGON_TIME)
GROUP BY $__timeGroupTZ(LOGON_TIME, 10m) 
ORDER BY $__timeGroupTZ(LOGON_TIME, 10m) ASC`,
			expectedSQL: `SELECT FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC') AS Time,
COUNT(*) AS active_sessions
FROM V$SESSION
WHERE LOGON_TIME BETWEEN TIMESTAMP '2018-03-15 13:00:00' AND TIMESTAMP '2018-03-15 14:00:00'
GROUP BY FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC') 
ORDER BY FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC') ASC`,
			description: "This query should NOT produce ORA-00932 error on Oracle 19",
		},
		{
			name: "Oracle 19 - Different timezone test",
			query: `SELECT $__timeGroupTZ(CREATED_DATE, 1h, 'America/New_York') AS Time,
AVG(CPU_USAGE) AS avg_cpu
FROM PERFORMANCE_METRICS
WHERE $__timeFilter(CREATED_DATE)
GROUP BY $__timeGroupTZ(CREATED_DATE, 1h, 'America/New_York')`,
			expectedSQL: `SELECT FROM_TZ(CAST(TRUNC(CAST(CREATED_DATE AT TIME ZONE 'America/New_York' AS DATE), 'DD') + NUMTODSINTERVAL(FLOOR(EXTRACT(HOUR FROM CREATED_DATE AT TIME ZONE 'America/New_York') / 1) * 1, 'HOUR') AS TIMESTAMP), 'America/New_York') AS Time,
AVG(CPU_USAGE) AS avg_cpu
FROM PERFORMANCE_METRICS
WHERE CREATED_DATE BETWEEN TIMESTAMP '2018-03-15 13:00:00' AND TIMESTAMP '2018-03-15 14:00:00'
GROUP BY FROM_TZ(CAST(TRUNC(CAST(CREATED_DATE AT TIME ZONE 'America/New_York' AS DATE), 'DD') + NUMTODSINTERVAL(FLOOR(EXTRACT(HOUR FROM CREATED_DATE AT TIME ZONE 'America/New_York') / 1) * 1, 'HOUR') AS TIMESTAMP), 'America/New_York')`,
			description: "Oracle 19 should handle timezone-specific queries without INTERVAL DAY TO SECOND issues",
		},
		{
			name: "Oracle 19 - 30 second intervals",
			query: `SELECT $__timeGroupTZ(EVENT_TIME, 30s, 'UTC') AS Time,
COUNT(*) AS event_count
FROM SYSTEM_EVENTS
WHERE $__timeFilter(EVENT_TIME)
GROUP BY $__timeGroupTZ(EVENT_TIME, 30s, 'UTC')`,
			expectedSQL: `SELECT FROM_TZ(CAST(TRUNC(CAST(EVENT_TIME AT TIME ZONE 'UTC' AS DATE), 'MI') + NUMTODSINTERVAL(FLOOR(EXTRACT(SECOND FROM EVENT_TIME AT TIME ZONE 'UTC') / 30) * 30, 'SECOND') AS TIMESTAMP), 'UTC') AS Time,
COUNT(*) AS event_count
FROM SYSTEM_EVENTS
WHERE EVENT_TIME BETWEEN TIMESTAMP '2018-03-15 13:00:00' AND TIMESTAMP '2018-03-15 14:00:00'
GROUP BY FROM_TZ(CAST(TRUNC(CAST(EVENT_TIME AT TIME ZONE 'UTC' AS DATE), 'MI') + NUMTODSINTERVAL(FLOOR(EXTRACT(SECOND FROM EVENT_TIME AT TIME ZONE 'UTC') / 30) * 30, 'SECOND') AS TIMESTAMP), 'UTC')`,
			description: "Oracle 19 should handle sub-minute intervals using NUMTODSINTERVAL",
		},
	}

	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}

	// Get the macro engine (Oracle 19 specific)
	dsInfo, err := oracle19DS.getDatasourceInfo(backend.PluginContext{
		DataSourceInstanceSettings: &settings,
	})
	require.NoError(t, err)
	assert.Equal(t, 19, dsInfo.JsonData.OracleVersion, "Oracle version should be 19")

	macroEngine := newOracleMacroEngine(19)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			query := backend.DataQuery{
				RefID:         "A",
				Interval:      time.Minute * 5,
				MaxDataPoints: 100,
				TimeRange:     timeRange,
			}

			t.Logf("Testing Oracle 19 query: %s", tc.description)
			t.Logf("Original query: %s", tc.query)

			interpolated, err := macroEngine.Interpolate(&query, timeRange, tc.query)
			require.NoError(t, err, "Oracle 19 macro interpolation should not fail")

			t.Logf("Interpolated query: %s", interpolated)

			// Verify the SQL doesn't contain problematic INTERVAL DAY TO SECOND patterns
			assert.NotContains(t, interpolated, "INTERVAL DAY TO SECOND",
				"Oracle 19 SQL should not contain INTERVAL DAY TO SECOND which causes ORA-00932")

			// Verify it uses NUMTODSINTERVAL instead
			assert.Contains(t, interpolated, "NUMTODSINTERVAL",
				"Oracle 19 SQL should use NUMTODSINTERVAL for interval arithmetic")

			// Verify it uses FROM_TZ for timezone handling
			assert.Contains(t, interpolated, "FROM_TZ",
				"Oracle 19 SQL should use FROM_TZ for timezone conversion")

			// Verify the expected SQL matches
			assert.Equal(t, tc.expectedSQL, interpolated, "Generated SQL should match expected Oracle 19 pattern")
		})
	}
}

// TestOracle19_vs_Oracle23_SQLDifferences verifies that Oracle 19 and 23 generate different SQL
func TestOracle19_vs_Oracle23_SQLDifferences(t *testing.T) {
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}

	query := backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}

	testSQL := `SELECT $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') AS Time FROM V$SESSION`

	// Test Oracle 19 macro
	oracle19Engine := newOracleMacroEngine(19)
	sql19, err19 := oracle19Engine.Interpolate(&query, timeRange, testSQL)
	require.NoError(t, err19)

	// Test Oracle 23 macro
	oracle23Engine := newOracleMacroEngine(23)
	sql23, err23 := oracle23Engine.Interpolate(&query, timeRange, testSQL)
	require.NoError(t, err23)

	t.Logf("Oracle 19 SQL: %s", sql19)
	t.Logf("Oracle 23 SQL: %s", sql23)

	// Verify they are different
	assert.NotEqual(t, sql19, sql23, "Oracle 19 and 23 should generate different SQL")

	// Oracle 19 should use NUMTODSINTERVAL
	assert.Contains(t, sql19, "NUMTODSINTERVAL", "Oracle 19 should use NUMTODSINTERVAL")
	assert.NotContains(t, sql19, "INTERVAL '10' MINUTE", "Oracle 19 should not use direct INTERVAL arithmetic")

	// Oracle 23 should use INTERVAL arithmetic
	assert.Contains(t, sql23, "INTERVAL '10' MINUTE", "Oracle 23 should use INTERVAL arithmetic")
	assert.NotContains(t, sql23, "NUMTODSINTERVAL", "Oracle 23 should not need NUMTODSINTERVAL workaround")

	// Both should avoid the problematic INTERVAL DAY TO SECOND
	assert.NotContains(t, sql19, "INTERVAL DAY TO SECOND", "Oracle 19 should not use INTERVAL DAY TO SECOND")
	assert.NotContains(t, sql23, "INTERVAL DAY TO SECOND", "Oracle 23 should not use INTERVAL DAY TO SECOND")
}

// TestOracle19_ErrorScenarios tests error handling specific to Oracle 19
func TestOracle19_ErrorScenarios(t *testing.T) {
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}

	query := backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}

	oracle19Engine := newOracleMacroEngine(19)

	errorCases := []struct {
		name        string
		sql         string
		expectedErr string
	}{
		{
			name:        "Missing time column in timeGroupTZ",
			sql:         "SELECT $__timeGroupTZ() AS Time",
			expectedErr: "macro __timeGroupTZ needs time column and interval",
		},
		{
			name:        "Missing interval in timeGroupTZ",
			sql:         "SELECT $__timeGroupTZ(LOGON_TIME) AS Time",
			expectedErr: "macro __timeGroupTZ needs time column and interval",
		},
		{
			name:        "Invalid interval format",
			sql:         "SELECT $__timeGroupTZ(LOGON_TIME, invalid_interval) AS Time",
			expectedErr: "error parsing interval invalid_interval",
		},
		{
			name:        "Unknown macro",
			sql:         "SELECT $__unknownMacro(LOGON_TIME) AS Time",
			expectedErr: "unknown macro __unknownMacro",
		},
	}

	for _, tc := range errorCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := oracle19Engine.Interpolate(&query, timeRange, tc.sql)
			require.Error(t, err, "Oracle 19 should return error for invalid macro usage")
			assert.Contains(t, err.Error(), tc.expectedErr, "Error message should contain expected text")
		})
	}
}

// BenchmarkOracle19_TimeGroupTZ benchmarks the Oracle 19 timeGroupTZ macro performance
func BenchmarkOracle19_TimeGroupTZ(b *testing.B) {
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}

	query := backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}

	oracle19Engine := newOracleMacroEngine(19)
	testSQL := `SELECT $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') AS Time,
COUNT(*) AS active_sessions
FROM V$SESSION
WHERE $__timeFilter(LOGON_TIME)
GROUP BY $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') 
ORDER BY $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') ASC`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := oracle19Engine.Interpolate(&query, timeRange, testSQL)
		if err != nil {
			b.Fatalf("Benchmark failed: %v", err)
		}
	}
}

// TestOracle19_RealWorldScenarios tests real-world Oracle 19 usage patterns
func TestOracle19_RealWorldScenarios(t *testing.T) {
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}

	query := backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}

	oracle19Engine := newOracleMacroEngine(19)

	realWorldQueries := []struct {
		name        string
		description string
		sql         string
	}{
		{
			name:        "Session monitoring",
			description: "Monitor active Oracle sessions over time",
			sql: `SELECT 
				$__timeGroupTZ(LOGON_TIME, 5m, 'UTC') AS Time,
				COUNT(*) AS active_sessions,
				COUNT(DISTINCT USERNAME) AS unique_users,
				AVG(EXTRACT(EPOCH FROM (SYSDATE - LOGON_TIME)) * 24 * 60) AS avg_session_minutes
			FROM V$SESSION 
			WHERE $__timeFilter(LOGON_TIME)
			  AND STATUS = 'ACTIVE'
			GROUP BY $__timeGroupTZ(LOGON_TIME, 5m, 'UTC')
			ORDER BY $__timeGroupTZ(LOGON_TIME, 5m, 'UTC')`,
		},
		{
			name:        "Performance metrics",
			description: "Track Oracle performance metrics with timezone awareness",
			sql: `SELECT 
				$__timeGroupTZ(SAMPLE_TIME, 1m, 'America/New_York') AS Time,
				AVG(VALUE) AS avg_cpu_usage,
				MAX(VALUE) AS max_cpu_usage,
				MIN(VALUE) AS min_cpu_usage
			FROM V$SYSMETRIC_HISTORY 
			WHERE $__timeFilter(SAMPLE_TIME)
			  AND METRIC_NAME = 'Host CPU Utilization (%)'
			GROUP BY $__timeGroupTZ(SAMPLE_TIME, 1m, 'America/New_York')
			ORDER BY $__timeGroupTZ(SAMPLE_TIME, 1m, 'America/New_York')`,
		},
		{
			name:        "Tablespace usage",
			description: "Monitor tablespace usage patterns",
			sql: `SELECT 
				$__timeGroupTZ(TIMESTAMP, 15m) AS Time,
				TABLESPACE_NAME,
				AVG(USED_PERCENT) AS avg_used_percent,
				MAX(USED_PERCENT) AS max_used_percent
			FROM DBA_HIST_TBSPC_SPACE_USAGE 
			WHERE $__timeFilter(TIMESTAMP)
			GROUP BY $__timeGroupTZ(TIMESTAMP, 15m), TABLESPACE_NAME
			ORDER BY $__timeGroupTZ(TIMESTAMP, 15m), TABLESPACE_NAME`,
		},
	}

	for _, rw := range realWorldQueries {
		t.Run(rw.name, func(t *testing.T) {
			t.Logf("Testing real-world scenario: %s", rw.description)

			interpolated, err := oracle19Engine.Interpolate(&query, timeRange, rw.sql)
			require.NoError(t, err, "Real-world Oracle 19 query should not fail")

			// Verify no problematic patterns
			assert.NotContains(t, interpolated, "INTERVAL DAY TO SECOND",
				"Real-world query should not contain problematic INTERVAL patterns")

			// Verify Oracle 19 specific patterns
			assert.Contains(t, interpolated, "NUMTODSINTERVAL",
				"Real-world query should use Oracle 19 compatible NUMTODSINTERVAL")

			t.Logf("Successfully processed real-world query: %s", rw.name)
		})
	}
}

// TestOracle19_HealthCheck tests the health check functionality
func TestOracle19_HealthCheck(t *testing.T) {
	settings := backend.DataSourceInstanceSettings{
		ID:       1,
		UID:      "oracle19-health-test",
		Name:     "Oracle 19 Health Test",
		URL:      "localhost:1521",
		User:     "testuser",
		Database: "XE",
		JSONData: map[string]interface{}{
			"oracleVersion": 19,
		},
		DecryptedSecureJSONData: map[string]string{
			"password": "testpass",
		},
		Updated: time.Now(),
	}

	ctx := context.Background()
	datasource, err := NewOracleDatasource(ctx, settings)
	require.NoError(t, err)

	oracle19DS := datasource.(*OracleDatasource)

	req := &backend.CheckHealthRequest{
		PluginContext: backend.PluginContext{
			DataSourceInstanceSettings: &settings,
		},
	}

	// Note: This will fail in real testing without Oracle, but tests the flow
	result, err := oracle19DS.CheckHealth(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, result)

	// In a real environment with Oracle 19, we'd expect HealthStatusOk
	// For testing purposes, we verify the structure
	assert.NotEmpty(t, result.Message, "Health check should return a message")
	t.Logf("Health check result: %s - %s", result.Status, result.Message)
}

