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
	databaseQueryHistogram *prometheus.HistogramVec
	logger                 log.Logger
)

func init() {
	databaseQueryCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "database_queries_total",
		Help:      "The total amount of Database queries",
	}, []string{"status"})

	databaseQueryHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "http_request_duration_seconds",
		Help:      "Database query histogram",
		Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
	}, []string{"status"})

	prometheus.MustRegister(databaseQueryCounter, databaseQueryHistogram)

	logger = log.New("DBMetrics")
}

// WrapDatabaseDriverWithHooks creates a fake database driver that
// executes Pre and post functions which we use to gather metrics about
// database queries.
func WrapDatabaseDriverWithHooks(dbType string) string {
	var d driver.Driver
	if dbType == migrator.SQLITE {
		d = &sqlite3.SQLiteDriver{}
	}
	if dbType == migrator.MYSQL {
		d = &mysql.MySQLDriver{}
	}
	if dbType == migrator.POSTGRES {
		d = &pq.Driver{}
	}

	var driverWithHooks string = dbType + "WithHooks"
	sql.Register(driverWithHooks, sqlhooks.Wrap(d, &databaseQueryWrapper{}))
	core.RegisterDriver(driverWithHooks, &databaseQueryWrapperParser{dbType: dbType})
	return driverWithHooks
}

// databaseQueryWrapper satisfies the sqlhook.databaseQueryWrapper interface
// which allow use to wrapp all SQL queries with a `Before` & `After` hook.
type databaseQueryWrapper struct{}

// databaseQueryWrapperKey is used as key to save values in `context.Context`
type databaseQueryWrapperKey struct{}

// Before hook will print the query with it's args and return the context with the timestamp
func (h *databaseQueryWrapper) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	return context.WithValue(ctx, databaseQueryWrapperKey{}, time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *databaseQueryWrapper) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	begin := ctx.Value(databaseQueryWrapperKey{}).(time.Time) //type check
	databaseQueryCounter.WithLabelValues("success").Inc()
	databaseQueryHistogram.WithLabelValues("success").Observe(time.Since(begin).Seconds())
	logger.Debug("query finished", "status", "success", "elapsed time", time.Since(begin), "sql", query)
	return ctx, nil
}

// OnError instances will be called if any error happens
func (h *databaseQueryWrapper) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	begin := ctx.Value(databaseQueryWrapperKey{}).(time.Time) //type check
	databaseQueryCounter.WithLabelValues("error").Inc()
	databaseQueryHistogram.WithLabelValues("error").Observe(time.Since(begin).Seconds())
	logger.Debug("query finished", "status", "error", "elapsed time", time.Since(begin), "sql", query)
	return nil
}

type databaseQueryWrapperParser struct {
	dbType string
}

func (hp *databaseQueryWrapperParser) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{
		DbType: core.DbType(hp.dbType),
	}, nil
}
