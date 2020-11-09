package sqlstore

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"time"

	"github.com/gchaincl/sqlhooks"
	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/lib/pq"
	"github.com/mattn/go-sqlite3"
	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/core"
)

var (
	databaseQueryCounter   *prometheus.CounterVec
	databaseQueryHistogram prometheus.Histogram
)

func init() {
	databaseQueryCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "database_queries_total",
		Help:      "The total amount of Database queries",
	}, []string{"status"})

	databaseQueryHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "database_queries_duration_seconds",
		Help:      "Database query histogram",
		Buckets:   prometheus.ExponentialBuckets(0.0001, 4, 9),
	})

	prometheus.MustRegister(databaseQueryCounter, databaseQueryHistogram)
}

// WrapDatabaseDriverWithHooks creates a fake database driver that
// executes pre and post functions which we use to gather metrics about
// database queries.
func WrapDatabaseDriverWithHooks(dbType string) string {
	drivers := map[string]driver.Driver{
		migrator.SQLITE:   &sqlite3.SQLiteDriver{},
		migrator.MYSQL:    &mysql.MySQLDriver{},
		migrator.POSTGRES: &pq.Driver{},
	}

	d, exist := drivers[dbType]
	if !exist {
		return dbType
	}

	driverWithHooks := dbType + "WithHooks"
	sql.Register(driverWithHooks, sqlhooks.Wrap(d, &databaseQueryWrapper{log: log.New("sqlstore.metrics")}))
	core.RegisterDriver(driverWithHooks, &databaseQueryWrapperParser{dbType: dbType})
	return driverWithHooks
}

// databaseQueryWrapper satisfies the sqlhook.databaseQueryWrapper interface
// which allow us to wrap all SQL queries with a `Before` & `After` hook.
type databaseQueryWrapper struct {
	log log.Logger
}

// databaseQueryWrapperKey is used as key to save values in `context.Context`
type databaseQueryWrapperKey struct{}

// Before hook will print the query with its args and return the context with the timestamp
func (h *databaseQueryWrapper) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	return context.WithValue(ctx, databaseQueryWrapperKey{}, time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *databaseQueryWrapper) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	begin := ctx.Value(databaseQueryWrapperKey{}).(time.Time)
	elapsed := time.Since(begin)
	databaseQueryCounter.WithLabelValues("success").Inc()
	databaseQueryHistogram.Observe(elapsed.Seconds())
	h.log.Debug("query finished", "status", "success", "elapsed time", elapsed, "sql", query)
	return ctx, nil
}

// OnError will be called if any error happens
func (h *databaseQueryWrapper) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	status := "error"
	// https://golang.org/pkg/database/sql/driver/#ErrSkip
	if err == nil || err == driver.ErrSkip {
		status = "success"
	}

	begin := ctx.Value(databaseQueryWrapperKey{}).(time.Time)
	elapsed := time.Since(begin)
	databaseQueryCounter.WithLabelValues(status).Inc()
	databaseQueryHistogram.Observe(elapsed.Seconds())
	h.log.Debug("query finished", "status", status, "elapsed time", elapsed, "sql", query, "error", err)
	return err
}

type databaseQueryWrapperParser struct {
	dbType string
}

func (hp *databaseQueryWrapperParser) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{
		DbType: core.DbType(hp.dbType),
	}, nil
}
