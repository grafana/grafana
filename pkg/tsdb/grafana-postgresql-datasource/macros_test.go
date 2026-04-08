package postgres

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestMacroEngine(t *testing.T) {
	timescaledbEnabled := false
	engine := newPostgresMacroEngine(timescaledbEnabled)
	timescaledbEnabled = true
	engineTS := newPostgresMacroEngine(timescaledbEnabled)
	query := &backend.DataQuery{}

	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := backend.TimeRange{From: from, To: to}

		t.Run("interpolate __time function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__time(time_column)")
			require.NoError(t, err)
			require.Equal(t, "select time_column AS \"time\"", sql)
		})

		t.Run("interpolate __time function wrapped in aggregation", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select min($__time(time_column))")
			require.NoError(t, err)

			require.Equal(t, "select min(time_column AS \"time\")", sql)
		})

		t.Run("interpolate __timeFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			require.NoError(t, err)

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339Nano), to.Format(time.RFC3339Nano)), sql)
		})

		t.Run("interpolate __timeFrom function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom()")
			require.NoError(t, err)

			require.Equal(t, "select '2018-04-12T18:00:00Z'", sql)
		})

		t.Run("interpolate __timeTo function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeTo()")
			require.NoError(t, err)

			require.Equal(t, "select '2018-04-12T18:05:00Z'", sql)
		})

		t.Run("interpolate __timeGroup function pre 5.3 compatibility", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "SELECT $__timeGroup(time_column,'5m'), value")
			require.NoError(t, err)

			require.Equal(t, "SELECT floor(extract(epoch from time_column)/300)*300 AS \"time\", value", sql)

			sql, err = engine.Interpolate(query, timeRange, "SELECT $__timeGroup(time_column,'5m') as time, value")
			require.NoError(t, err)

			require.Equal(t, "SELECT floor(extract(epoch from time_column)/300)*300 as time, value", sql)
		})

		t.Run("interpolate __timeGroup function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "SELECT $__timeGroup(time_column,'5m')")
			require.NoError(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "SELECT $__timeGroupAlias(time_column,'5m')")
			require.NoError(t, err)

			require.Equal(t, "SELECT floor(extract(epoch from time_column)/300)*300", sql)
			require.Equal(t, sql2, sql+" AS \"time\"")
		})

		t.Run("interpolate __timeGroup function with spaces between args", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "$__timeGroup(time_column , '5m')")
			require.NoError(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "$__timeGroupAlias(time_column , '5m')")
			require.NoError(t, err)

			require.Equal(t, "floor(extract(epoch from time_column)/300)*300", sql)
			require.Equal(t, sql2, sql+" AS \"time\"")
		})

		t.Run("interpolate __timeGroup function with TimescaleDB enabled", func(t *testing.T) {
			sql, err := engineTS.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
			require.NoError(t, err)
			require.Equal(t, "GROUP BY time_bucket('300.000s',time_column)", sql)
		})

		t.Run("interpolate __timeGroup function with spaces between args and TimescaleDB enabled", func(t *testing.T) {
			sql, err := engineTS.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
			require.NoError(t, err)
			require.Equal(t, "GROUP BY time_bucket('300.000s',time_column)", sql)
		})

		t.Run("interpolate __timeGroup function with large time range as an argument and TimescaleDB enabled", func(t *testing.T) {
			sql, err := engineTS.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '12d')")
			require.NoError(t, err)
			require.Equal(t, "GROUP BY time_bucket('1036800.000s',time_column)", sql)
		})

		t.Run("interpolate __timeGroup function with small time range as an argument and TimescaleDB enabled", func(t *testing.T) {
			sql, err := engineTS.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '20ms')")
			require.NoError(t, err)
			require.Equal(t, "GROUP BY time_bucket('0.020s',time_column)", sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.UnixNano(), to.UnixNano()), sql)
		})

		t.Run("interpolate __unixEpochNanoFrom function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFrom()")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select %d", from.UnixNano()), sql)
		})

		t.Run("interpolate __unixEpochNanoTo function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoTo()")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select %d", to.UnixNano()), sql)
		})

		t.Run("interpolate __unixEpochGroup function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "SELECT $__unixEpochGroup(time_column+time_adjustment,'5m')")
			require.NoError(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "SELECT $__unixEpochGroupAlias(time_column+time_adjustment,'5m')")
			require.NoError(t, err)
			require.Equal(t, "SELECT floor((time_column+time_adjustment)/300)*300", sql)
			require.Equal(t, sql2, sql+" AS \"time\"")
		})
	})

	t.Run("Given a time range between 1960-02-01 07:00 and 1965-02-03 08:00", func(t *testing.T) {
		from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
		to := time.Date(1965, 2, 3, 8, 0, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}

		t.Run("interpolate __timeFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339Nano), to.Format(time.RFC3339Nano)), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.UnixNano(), to.UnixNano()), sql)
		})
	})

	t.Run("Given a time range between 1960-02-01 07:00 and 1980-02-03 08:00", func(t *testing.T) {
		from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
		to := time.Date(1980, 2, 3, 8, 0, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}

		t.Run("interpolate __timeFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339Nano), to.Format(time.RFC3339Nano)), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.UnixNano(), to.UnixNano()), sql)
		})
	})

	t.Run("Given a time range between 1960-02-01 07:00:00.5 and 1980-02-03 08:00:00.5", func(t *testing.T) {
		from := time.Date(1960, 2, 1, 7, 0, 0, 500e6, time.UTC)
		to := time.Date(1980, 2, 3, 8, 0, 0, 500e6, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}
		require.Equal(t, "1960-02-01T07:00:00.5Z", from.Format(time.RFC3339Nano))
		require.Equal(t, "1980-02-03T08:00:00.5Z", to.Format(time.RFC3339Nano))

		t.Run("interpolate __timeFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			require.NoError(t, err)
			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339Nano), to.Format(time.RFC3339Nano)), sql)
		})
	})
}

func TestMacroEngineConcurrency(t *testing.T) {
	engine := newPostgresMacroEngine(false)
	query1 := backend.DataQuery{
		JSON: []byte{},
	}
	query2 := backend.DataQuery{
		JSON: []byte{},
	}
	from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
	to := from.Add(5 * time.Minute)
	timeRange := backend.TimeRange{From: from, To: to}

	var wg sync.WaitGroup
	wg.Add(2)

	go func(query backend.DataQuery) {
		defer wg.Done()
		_, err := engine.Interpolate(&query, timeRange, "SELECT $__timeGroup(time_column,'5m')")
		require.NoError(t, err)
	}(query1)

	go func(query backend.DataQuery) {
		_, err := engine.Interpolate(&query, timeRange, "SELECT $__timeGroup(time_column,'5m')")
		require.NoError(t, err)
		defer wg.Done()
	}(query2)

	wg.Wait()
}

func TestStripSQLComments(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "line comment stripped",
			input: "SELECT 1 -- a comment",
			want:  "SELECT 1 ",
		},
		{
			name:  "block comment stripped",
			input: "SELECT /* a comment */ 1",
			want:  "SELECT  1",
		},
		{
			name:  "multiline block comment stripped",
			input: "SELECT /*\n  multiline\n  comment\n*/ 1",
			want:  "SELECT  1",
		},
		{
			name:  "line comment inside single-quoted string preserved",
			input: "SELECT '-- not a comment' AS label",
			want:  "SELECT '-- not a comment' AS label",
		},
		{
			name:  "block comment inside single-quoted string preserved",
			input: "SELECT '/* not a comment */' AS label",
			want:  "SELECT '/* not a comment */' AS label",
		},
		{
			name:  "line comment inside double-quoted identifier preserved",
			input: `SELECT "col -- name" FROM t`,
			want:  `SELECT "col -- name" FROM t`,
		},
		{
			name:  "block comment inside double-quoted identifier preserved",
			input: `SELECT "col /* name */" FROM t`,
			want:  `SELECT "col /* name */" FROM t`,
		},
		{
			name:  "doubled-quote escape inside single-quoted string",
			input: "SELECT 'it''s fine -- not a comment' AS v",
			want:  "SELECT 'it''s fine -- not a comment' AS v",
		},
		{
			name:  "doubled-quote escape inside double-quoted identifier",
			input: `SELECT "col ""-- name""" FROM t`,
			want:  `SELECT "col ""-- name""" FROM t`,
		},
		{
			name:  "mixed: -- inside string then real -- comment",
			input: "SELECT '-- in string' AS a -- real comment",
			want:  "SELECT '-- in string' AS a ",
		},
		{
			name:  "mixed: block comment inside string then real block comment",
			input: "SELECT '/* in string */' AS a /* real comment */",
			want:  "SELECT '/* in string */' AS a ",
		},
		{
			name:  "no-op: query with no comments",
			input: "SELECT col FROM t WHERE col > 1",
			want:  "SELECT col FROM t WHERE col > 1",
		},
		{
			name:  "newline after line comment is preserved",
			input: "SELECT 1 -- comment\nFROM t",
			want:  "SELECT 1 \nFROM t",
		},
		{
			name:  "line comment inside empty dollar-quoted string preserved",
			input: "SELECT $$ -- not a comment $$",
			want:  "SELECT $$ -- not a comment $$",
		},
		{
			name:  "block comment inside empty dollar-quoted string preserved",
			input: "SELECT $$ /* not a comment */ $$",
			want:  "SELECT $$ /* not a comment */ $$",
		},
		{
			name:  "line comment inside tagged dollar-quoted string preserved",
			input: "SELECT $body$ -- not a comment $body$",
			want:  "SELECT $body$ -- not a comment $body$",
		},
		{
			name:  "grafana macro not confused with dollar-quote",
			input: "SELECT $__timeFrom() -- comment",
			want:  "SELECT $__timeFrom() ",
		},
		{
			name:  "positional parameter not confused with dollar-quote",
			input: "SELECT $1 -- comment",
			want:  "SELECT $1 ",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, stripSQLComments(tc.input))
		})
	}
}
