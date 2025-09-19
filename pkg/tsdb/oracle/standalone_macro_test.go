package oracle

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestStandaloneMacroEngine tests just the macro engine without datasource dependencies
func TestStandaloneMacroEngine_Oracle19_TimeGroupTZ(t *testing.T) {
	// Create Oracle 19 macro engine
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

	// Test the exact query from GitHub issue #111134
	originalQuery := `SELECT $__timeGroupTZ(LOGON_TIME, 10m) AS Time,
COUNT(*) AS active_sessions
FROM V$SESSION
WHERE $__timeFilter(LOGON_TIME)
GROUP BY $__timeGroupTZ(LOGON_TIME, 10m) 
ORDER BY $__timeGroupTZ(LOGON_TIME, 10m) ASC`

	t.Logf("Testing Oracle 19 timeGroupTZ macro with original failing query from issue #111134")

	interpolated, err := engine.Interpolate(query, timeRange, originalQuery)
	require.NoError(t, err, "Oracle 19 timeGroupTZ macro should work without errors")

	t.Logf("Original query:\n%s", originalQuery)
	t.Logf("Interpolated query:\n%s", interpolated)

	// Verify the key fixes for Oracle 19
	assert.NotContains(t, interpolated, "INTERVAL DAY TO SECOND",
		"Oracle 19 SQL should NOT contain 'INTERVAL DAY TO SECOND' which causes ORA-00932 error")

	assert.Contains(t, interpolated, "NUMTODSINTERVAL",
		"Oracle 19 SQL should use NUMTODSINTERVAL for safe interval arithmetic")

	assert.Contains(t, interpolated, "FROM_TZ",
		"Oracle 19 SQL should use FROM_TZ for timezone conversion")

	assert.Contains(t, interpolated, "TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE)",
		"Oracle 19 SQL should use proper date truncation")

	// Verify time filter is correctly interpolated
	assert.Contains(t, interpolated, "LOGON_TIME BETWEEN TIMESTAMP '2018-03-15 13:00:00' AND TIMESTAMP '2018-03-15 14:00:00'",
		"Time filter should be correctly interpolated")

	// Verify the specific Oracle 19 pattern for 10-minute intervals
	expectedPattern := "FROM_TZ(CAST(TRUNC(CAST(LOGON_TIME AT TIME ZONE 'UTC' AS DATE), 'HH24') + NUMTODSINTERVAL(FLOOR(EXTRACT(MINUTE FROM LOGON_TIME AT TIME ZONE 'UTC') / 10) * 10, 'MINUTE') AS TIMESTAMP), 'UTC')"
	assert.Contains(t, interpolated, expectedPattern,
		"Oracle 19 should generate the specific NUMTODSINTERVAL pattern for 10-minute grouping")

	t.Logf("✅ Oracle 19 timeGroupTZ macro test PASSED - no more ORA-00932 errors!")
}

// TestStandaloneMacroEngine_Oracle23_Comparison tests Oracle 23 for comparison
func TestStandaloneMacroEngine_Oracle23_Comparison(t *testing.T) {
	// Create Oracle 23 macro engine
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

	originalQuery := `SELECT $__timeGroupTZ(LOGON_TIME, 10m) AS Time FROM V$SESSION`

	interpolated, err := engine.Interpolate(query, timeRange, originalQuery)
	require.NoError(t, err, "Oracle 23 timeGroupTZ macro should work without errors")

	t.Logf("Oracle 23 interpolated query:\n%s", interpolated)

	// Oracle 23 should use INTERVAL arithmetic (which is more efficient)
	assert.Contains(t, interpolated, "INTERVAL '10' MINUTE",
		"Oracle 23 SQL should use direct INTERVAL arithmetic")

	assert.NotContains(t, interpolated, "NUMTODSINTERVAL",
		"Oracle 23 SQL should not need NUMTODSINTERVAL workaround")

	t.Logf("✅ Oracle 23 timeGroupTZ macro test PASSED - uses efficient INTERVAL arithmetic")
}

// TestStandaloneMacroEngine_VersionDifferences demonstrates the key differences
func TestStandaloneMacroEngine_VersionDifferences(t *testing.T) {
	from := time.Date(2018, 3, 15, 13, 0, 0, 0, time.UTC)
	to := time.Date(2018, 3, 15, 14, 0, 0, 0, time.UTC)
	timeRange := backend.TimeRange{From: from, To: to}

	query := &backend.DataQuery{
		RefID:         "A",
		Interval:      time.Minute * 5,
		MaxDataPoints: 100,
		TimeRange:     timeRange,
	}

	testQuery := `SELECT $__timeGroupTZ(LOGON_TIME, 10m, 'UTC') AS Time FROM V$SESSION`

	// Test Oracle 19
	engine19 := newOracleMacroEngine(19)
	sql19, err19 := engine19.Interpolate(query, timeRange, testQuery)
	require.NoError(t, err19)

	// Test Oracle 23
	engine23 := newOracleMacroEngine(23)
	sql23, err23 := engine23.Interpolate(query, timeRange, testQuery)
	require.NoError(t, err23)

	t.Logf("=== Oracle Version Comparison ===")
	t.Logf("Oracle 19 SQL:\n%s\n", sql19)
	t.Logf("Oracle 23 SQL:\n%s\n", sql23)

	// Verify they are different
	assert.NotEqual(t, sql19, sql23, "Oracle 19 and 23 should generate different SQL")

	// Verify Oracle 19 characteristics
	assert.Contains(t, sql19, "NUMTODSINTERVAL", "Oracle 19 uses NUMTODSINTERVAL")
	assert.NotContains(t, sql19, "INTERVAL '10' MINUTE", "Oracle 19 avoids direct INTERVAL arithmetic")

	// Verify Oracle 23 characteristics
	assert.Contains(t, sql23, "INTERVAL '10' MINUTE", "Oracle 23 uses direct INTERVAL arithmetic")
	assert.NotContains(t, sql23, "NUMTODSINTERVAL", "Oracle 23 doesn't need NUMTODSINTERVAL workaround")

	// Both should avoid the problematic pattern
	assert.NotContains(t, sql19, "INTERVAL DAY TO SECOND", "Oracle 19 avoids problematic INTERVAL DAY TO SECOND")
	assert.NotContains(t, sql23, "INTERVAL DAY TO SECOND", "Oracle 23 avoids problematic INTERVAL DAY TO SECOND")

	t.Logf("✅ Version differences test PASSED - Oracle 19 fix implemented correctly!")
}

// TestStandaloneMacroEngine_AllIntervals tests various interval types
func TestStandaloneMacroEngine_AllIntervals(t *testing.T) {
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

	intervalTests := []struct {
		interval string
		unit     string
	}{
		{"30s", "SECOND"},
		{"5m", "MINUTE"},
		{"1h", "HOUR"},
		{"1d", "DAY"},
	}

	for _, test := range intervalTests {
		t.Run(fmt.Sprintf("interval_%s", test.interval), func(t *testing.T) {
			testQuery := fmt.Sprintf("SELECT $__timeGroupTZ(TIME_COL, %s) AS Time FROM TEST_TABLE", test.interval)

			interpolated, err := engine.Interpolate(query, timeRange, testQuery)
			require.NoError(t, err, "Should handle %s intervals", test.interval)

			// Should use NUMTODSINTERVAL with the correct unit
			assert.Contains(t, interpolated, fmt.Sprintf("NUMTODSINTERVAL"),
				"Should use NUMTODSINTERVAL for %s intervals", test.interval)
			assert.Contains(t, interpolated, fmt.Sprintf("'%s'", test.unit),
				"Should use correct unit %s for %s intervals", test.unit, test.interval)

			// Should not contain problematic patterns
			assert.NotContains(t, interpolated, "INTERVAL DAY TO SECOND",
				"Should not use INTERVAL DAY TO SECOND for %s intervals", test.interval)

			t.Logf("✅ %s interval test PASSED", test.interval)
		})
	}
}
