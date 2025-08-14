package sqlstore

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"time"

	"github.com/gchaincl/sqlhooks"
	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	//"github.com/lib/pq"
	pq "gitcode.com/opengauss/openGauss-connector-go-pq"
	"github.com/mattn/go-sqlite3"
	"github.com/prometheus/client_golang/prometheus"
	cw "github.com/weaveworks/common/tracing"
	"xorm.io/core"
)

var (
	databaseQueryHistogram *prometheus.HistogramVec
)

func init() {
	databaseQueryHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "database_queries_duration_seconds",
		Help:      "Database query histogram",
		Buckets:   prometheus.ExponentialBuckets(0.00001, 4, 10),
	}, []string{"status"})

	prometheus.MustRegister(databaseQueryHistogram)
}

// WrapDatabaseDriverWithHooks creates a fake database driver that
// executes pre and post functions which we use to gather metrics about
// database queries. It also registers the metrics.
func WrapDatabaseDriverWithHooks(dbType string, tracer tracing.Tracer) string {
	drivers := map[string]driver.Driver{
		migrator.SQLite:   &sqlite3.SQLiteDriver{},
		migrator.MySQL:    &mysql.MySQLDriver{},
		migrator.Postgres: &pq.Driver{},
	}

	d, exist := drivers[dbType]
	if !exist {
		return dbType
	}

	driverWithHooks := dbType + "WithHooks"
	sql.Register(driverWithHooks, sqlhooks.Wrap(d, &databaseQueryWrapper{log: log.New("sqlstore.metrics"), tracer: tracer}))
	core.RegisterDriver(driverWithHooks, &databaseQueryWrapperDriver{dbType: dbType})
	return driverWithHooks
}

// databaseQueryWrapper satisfies the sqlhook.databaseQueryWrapper interface
// which allow us to wrap all SQL queries with a `Before` & `After` hook.
type databaseQueryWrapper struct {
	log    log.Logger
	tracer tracing.Tracer
}

// databaseQueryWrapperKey is used as key to save values in `context.Context`
type databaseQueryWrapperKey struct{}

// Before hook will print the query with its args and return the context with the timestamp
func (h *databaseQueryWrapper) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	return context.WithValue(ctx, databaseQueryWrapperKey{}, time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *databaseQueryWrapper) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	h.instrument(ctx, "success", query, nil)

	return ctx, nil
}

func (h *databaseQueryWrapper) instrument(ctx context.Context, status string, query string, err error) {
	begin := ctx.Value(databaseQueryWrapperKey{}).(time.Time)
	elapsed := time.Since(begin)

	histogram := databaseQueryHistogram.WithLabelValues(status)
	if traceID, ok := cw.ExtractSampledTraceID(ctx); ok {
		// Need to type-convert the Observer to an
		// ExemplarObserver. This will always work for a
		// HistogramVec.
		histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(
			elapsed.Seconds(), prometheus.Labels{"traceID": traceID},
		)
	} else {
		histogram.Observe(elapsed.Seconds())
	}

	_, span := h.tracer.Start(ctx, "database query")
	defer span.End()

	span.AddEvents([]string{"query", "status"}, []tracing.EventValue{{Str: query}, {Str: status}})

	if err != nil {
		span.AddEvents([]string{"error"}, []tracing.EventValue{{Str: err.Error()}})
	}

	h.log.Debug("query finished", "status", status, "elapsed time", elapsed, "sql", query, "error", err)
}

// OnError will be called if any error happens
func (h *databaseQueryWrapper) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	status := "error"
	// https://golang.org/pkg/database/sql/driver/#ErrSkip
	if err == nil || errors.Is(err, driver.ErrSkip) {
		status = "success"
	}

	h.instrument(ctx, status, query, err)

	return err
}

// databaseQueryWrapperDriver satisfies the xorm.io/core.Driver interface
type databaseQueryWrapperDriver struct {
	dbType string
}

func (hp *databaseQueryWrapperDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	driver := core.QueryDriver(hp.dbType)
	if driver == nil {
		return nil, fmt.Errorf("could not find driver with name %s", hp.dbType)
	}
	return driver.Parse(driverName, dataSourceName)
}
