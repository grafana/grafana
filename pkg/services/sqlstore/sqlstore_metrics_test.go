package sqlstore

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestSQLStore_Metrics(t *testing.T) {
	stats := sql.DBStats{
		MaxOpenConnections: 9,
		OpenConnections:    8,
		InUse:              4,
		Idle:               4,
		WaitCount:          5,
		WaitDuration:       6 * time.Second,
		MaxIdleClosed:      7,
		MaxIdleTimeClosed:  8,
		MaxLifetimeClosed:  9,
	}

	m := newSQLStoreMetrics(&fakeStatsGetter{stats: stats})

	require.NoError(t, testutil.CollectAndCompare(m, strings.NewReader(`
		# HELP grafana_database_conn_idle The number of idle connections
		# TYPE grafana_database_conn_idle gauge
		grafana_database_conn_idle 4
		# HELP grafana_database_conn_in_use The number of connections currently in use
		# TYPE grafana_database_conn_in_use gauge
		grafana_database_conn_in_use 4
		# HELP grafana_database_conn_max_idle_closed_seconds The total number of connections closed due to SetConnMaxIdleTime
		# TYPE grafana_database_conn_max_idle_closed_seconds counter
		grafana_database_conn_max_idle_closed_seconds 8
		# HELP grafana_database_conn_max_idle_closed_total The total number of connections closed due to SetMaxIdleConns
		# TYPE grafana_database_conn_max_idle_closed_total counter
		grafana_database_conn_max_idle_closed_total 7
		# HELP grafana_database_conn_max_lifetime_closed_total The total number of connections closed due to SetConnMaxLifetime
		# TYPE grafana_database_conn_max_lifetime_closed_total counter
		grafana_database_conn_max_lifetime_closed_total 9
		# HELP grafana_database_conn_max_open Maximum number of open connections to the database
		# TYPE grafana_database_conn_max_open gauge
		grafana_database_conn_max_open 9
		# HELP grafana_database_conn_open The number of established connections both in use and idle
		# TYPE grafana_database_conn_open gauge
		grafana_database_conn_open 8
		# HELP grafana_database_conn_wait_count_total The total number of connections waited for
		# TYPE grafana_database_conn_wait_count_total counter
		grafana_database_conn_wait_count_total 5
		# HELP grafana_database_conn_wait_duration_seconds The total time blocked waiting for a new connection
		# TYPE grafana_database_conn_wait_duration_seconds counter
		grafana_database_conn_wait_duration_seconds 6
	`)))
}

type fakeStatsGetter struct {
	stats sql.DBStats
}

var _ sqlstats.StatsGetter = (*fakeStatsGetter)(nil)

func (f *fakeStatsGetter) Stats() sql.DBStats {
	return f.stats
}
