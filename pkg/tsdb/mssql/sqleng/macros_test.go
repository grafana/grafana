package sqleng

import (
	"fmt"
	"sync"
	"testing"

	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/stretchr/testify/require"
)

func TestMacroEngine(t *testing.T) {
	engine := &msSQLMacroEngine{}
	query := &backend.DataQuery{
		JSON: []byte("{}"),
	}

	dfltTimeRange := backend.TimeRange{}

	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := backend.TimeRange{From: from, To: to}

		t.Run("interpolate __time function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, dfltTimeRange, "select $__time(time_column)")
			require.Nil(t, err)

			require.Equal(t, "select time_column AS time", sql)
		})

		t.Run("interpolate __timeEpoch function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, dfltTimeRange, "select $__timeEpoch(time_column)")
			require.Nil(t, err)

			require.Equal(t, "select DATEDIFF(second, '1970-01-01', time_column) AS time", sql)
		})

		t.Run("interpolate __timeEpoch function wrapped in aggregation", func(t *testing.T) {
			sql, err := engine.Interpolate(query, dfltTimeRange, "select min($__timeEpoch(time_column))")
			require.Nil(t, err)

			require.Equal(t, "select min(DATEDIFF(second, '1970-01-01', time_column) AS time)", sql)
		})

		t.Run("interpolate __timeFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339), to.Format(time.RFC3339)), sql)
		})

		t.Run("interpolate __timeFrom function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom()")
			require.Nil(t, err)

			require.Equal(t, "select '2018-04-12T18:00:00Z'", sql)
		})

		t.Run("interpolate __timeTo function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeTo()")
			require.Nil(t, err)

			require.Equal(t, "select '2018-04-12T18:05:00Z'", sql)
		})

		t.Run("interpolate __timeGroup function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
			require.Nil(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column,'5m')")
			require.Nil(t, err)

			require.Equal(t, "GROUP BY FLOOR(DATEDIFF(second, '1970-01-01', time_column)/300)*300", sql)
			require.Equal(t, sql+" AS [time]", sql2)
		})

		t.Run("interpolate __timeGroup function with spaces around arguments", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
			require.Nil(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column , '5m')")
			require.Nil(t, err)

			require.Equal(t, "GROUP BY FLOOR(DATEDIFF(second, '1970-01-01', time_column)/300)*300", sql)
			require.Equal(t, sql+" AS [time]", sql2)
		})

		t.Run("interpolate __timeGroup function with fill (value = NULL)", func(t *testing.T) {
			_, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m', NULL)")
			require.Nil(t, err)
			queryJson, err := query.JSON.MarshalJSON()
			require.Nil(t, err)
			require.Equal(t, `{"fill":true,"fillInterval":300,"fillMode":"null"}`, string(queryJson))
		})

		t.Run("interpolate __timeGroup function with fill (value = previous)", func(t *testing.T) {
			_, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m', previous)")
			require.Nil(t, err)
			queryJson, err := query.JSON.MarshalJSON()
			require.Nil(t, err)
			require.Equal(t, `{"fill":true,"fillInterval":300,"fillMode":"previous"}`, string(queryJson))
		})

		t.Run("interpolate __timeGroup function with fill (value = float)", func(t *testing.T) {
			_, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m', 1.5)")
			require.Nil(t, err)
			queryJson, err := query.JSON.MarshalJSON()
			require.Nil(t, err)
			require.Equal(t, `{"fill":true,"fillInterval":300,"fillMode":"value","fillValue":1.5}`, string(queryJson))
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.UnixNano(), to.UnixNano()), sql)
		})
		t.Run("interpolate __unixEpochNanoFrom function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFrom()")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select %d", from.UnixNano()), sql)
		})

		t.Run("interpolate __unixEpochNanoTo function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoTo()")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select %d", to.UnixNano()), sql)
		})

		t.Run("interpolate __unixEpochGroup function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "SELECT $__unixEpochGroup(time_column,'5m')")
			require.Nil(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "SELECT $__unixEpochGroupAlias(time_column,'5m')")
			require.Nil(t, err)

			require.Equal(t, "SELECT FLOOR(time_column/300)*300", sql)
			require.Equal(t, sql+" AS [time]", sql2)
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
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339), to.Format(time.RFC3339)), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.UnixNano(), to.UnixNano()), sql)
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
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN '%s' AND '%s'", from.Format(time.RFC3339), to.Format(time.RFC3339)), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time_column >= %d AND time_column <= %d", from.UnixNano(), to.UnixNano()), sql)
		})

		t.Run("should return unmodified sql if there are no macros present", func(t *testing.T) {
			sqls := []string{
				"select * from table",
				"select count(val) from table",
				"select col1, col2,col3, col4 from table where col1 = 'val1' and col2 = 'val2' order by col1 asc",
			}

			for _, sql := range sqls {
				actual, err := engine.Interpolate(query, timeRange, sql)
				require.Nil(t, err)
				require.Equal(t, sql, actual)
			}
		})
	})
}

func TestMacroEngineConcurrency(t *testing.T) {
	engine := newMssqlMacroEngine()
	query1 := backend.DataQuery{
		JSON: []byte{},
	}
	query2 := backend.DataQuery{
		JSON: []byte{},
	}
	from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
	to := from.Add(5 * time.Minute)
	timeRange := backend.TimeRange{
		From: from,
		To:   to,
	}

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
			name:  "line comment inside bracket-quoted identifier preserved",
			input: "SELECT [col -- name] FROM t",
			want:  "SELECT [col -- name] FROM t",
		},
		{
			name:  "block comment inside bracket-quoted identifier preserved",
			input: "SELECT [col /* name */] FROM t",
			want:  "SELECT [col /* name */] FROM t",
		},
		{
			name:  "doubled-bracket escape inside bracket identifier",
			input: "SELECT [col]]name] FROM t",
			want:  "SELECT [col]]name] FROM t",
		},
		{
			name:  "doubled-quote escape inside single-quoted string",
			input: "SELECT 'it''s fine -- not a comment' AS v",
			want:  "SELECT 'it''s fine -- not a comment' AS v",
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
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, stripSQLComments(tc.input))
		})
	}
}
