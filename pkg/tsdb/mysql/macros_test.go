package mysql

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestMacroEngine(t *testing.T) {
	engine := &mySQLMacroEngine{
		logger:    log.New("test"),
		userError: "inspect Grafana server log for details",
	}
	query := &backend.DataQuery{}

	t.Run("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func(t *testing.T) {
		from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
		to := from.Add(5 * time.Minute)
		timeRange := backend.TimeRange{From: from, To: to}

		t.Run("interpolate __time function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__time(time_column)")
			require.Nil(t, err)

			require.Equal(t, "select UNIX_TIMESTAMP(time_column) as time_sec", sql)
		})

		t.Run("interpolate __time function wrapped in aggregation", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select min($__time(time_column))")
			require.Nil(t, err)

			require.Equal(t, "select min(UNIX_TIMESTAMP(time_column) as time_sec)", sql)
		})

		t.Run("interpolate __timeGroup function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
			require.Nil(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column,'5m')")
			require.Nil(t, err)

			require.Equal(t, "GROUP BY UNIX_TIMESTAMP(time_column) DIV 300 * 300", sql)
			require.Equal(t, sql+" AS \"time\"", sql2)
		})

		t.Run("interpolate __timeGroup function with spaces around arguments", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
			require.Nil(t, err)
			sql2, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroupAlias(time_column , '5m')")
			require.Nil(t, err)

			require.Equal(t, "GROUP BY UNIX_TIMESTAMP(time_column) DIV 300 * 300", sql)
			require.Equal(t, sql+" AS \"time\"", sql2)
		})

		t.Run("interpolate __timeFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN FROM_UNIXTIME(%d) AND FROM_UNIXTIME(%d)", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __timeFrom function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom()")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select FROM_UNIXTIME(%d)", from.Unix()), sql)
		})

		t.Run("interpolate __timeTo function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeTo()")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select FROM_UNIXTIME(%d)", to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochNanoFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochNanoFilter(time)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.UnixNano(), to.UnixNano()), sql)
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

			require.Equal(t, "SELECT time_column DIV 300 * 300", sql)
			require.Equal(t, sql+" AS \"time\"", sql2)
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

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN DATE_ADD(FROM_UNIXTIME(0), INTERVAL %d SECOND) AND FROM_UNIXTIME(%d)", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()), sql)
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

			require.Equal(t, fmt.Sprintf("WHERE time_column BETWEEN DATE_ADD(FROM_UNIXTIME(0), INTERVAL %d SECOND) AND FROM_UNIXTIME(%d)", from.Unix(), to.Unix()), sql)
		})

		t.Run("interpolate __unixEpochFilter function", func(t *testing.T) {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(time)")
			require.Nil(t, err)

			require.Equal(t, fmt.Sprintf("select time >= %d AND time <= %d", from.Unix(), to.Unix()), sql)
		})
	})

	t.Run("Given queries that contains unallowed user functions", func(t *testing.T) {
		tcs := []string{
			"select \nSESSION_USER(), abc",
			"SELECT session_User( ) ",
			"SELECT session_User(	)\n",
			"SELECT current_user",
			"SELECT current_USER",
			"SELECT current_user()",
			"SELECT Current_User()",
			"SELECT current_user(   )",
			"SELECT current_user(\t )",
			"SELECT user()",
			"SELECT USER()",
			"SELECT SYSTEM_USER()",
			"SELECT System_User()",
			"SELECT System_User(  )",
			"SELECT System_User(\t \t)",
			"SHOW \t grants",
			" show Grants\n",
			"show grants;",
		}

		for _, tc := range tcs {
			_, err := engine.Interpolate(&backend.DataQuery{}, backend.TimeRange{}, tc)
			require.Equal(t, "invalid query - inspect Grafana server log for details", err.Error())
		}
	})
}

func TestMacroEngineConcurrency(t *testing.T) {
	engine := newMysqlMacroEngine(log.New("test"), setting.NewCfg())
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
