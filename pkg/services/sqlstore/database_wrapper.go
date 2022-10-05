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
	"github.com/lib/pq"
	"github.com/mattn/go-sqlite3"
	"github.com/prometheus/client_golang/prometheus"
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
// It expects multiple sqlhooks.Hooks and sqlhooks.OnErrorer that are executed sequentially.
func WrapDatabaseDriverWithHooks(dbType string, hooks []sqlhooks.Hooks, onErroers []sqlhooks.OnErrorer) string {
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

	sql.Register(driverWithHooks, sqlhooks.Wrap(d, &databaseWrapper{
		hooks:     hooks,
		onErroers: onErroers,
	}))

	core.RegisterDriver(driverWithHooks, &databaseQueryWrapperDriver{dbType: dbType})
	return driverWithHooks
}

type databaseWrapper struct {
	hooks     []sqlhooks.Hooks
	onErroers []sqlhooks.OnErrorer
}

// Before hook will print the query with its args and return the context with the timestamp
func (h *databaseWrapper) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	for _, hook := range h.hooks {
		c, err := hook.Before(ctx, query, args...)
		if err != nil {
			return ctx, err
		}
		ctx = c
	}
	return ctx, nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *databaseWrapper) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	for _, hook := range h.hooks {
		c, err := hook.After(ctx, query, args...)
		if err != nil {
			return ctx, err
		}
		ctx = c
	}
	return ctx, nil
}

// OnError will be called if any error happens
func (h *databaseWrapper) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	for _, hook := range h.onErroers {
		err := hook.OnError(ctx, err, query, args...)
		if err != nil {
			return err
		}
	}
	return nil
}

// databaseQueryInstrumenter satisfies the sqlhook.databaseQueryInstrumenter interface
// which allow us to wrap all SQL queries with a `Before` & `After` hook.
// It gathers metrics about database queries. It also registers the metrics.
type databaseQueryInstrumenter struct {
	log    log.Logger
	tracer tracing.Tracer
}

// databaseQueryWrapperKey is used as key to save values in `context.Context`
type databaseQueryWrapperKey struct{}

// Before hook will print the query with its args and return the context with the timestamp
func (h *databaseQueryInstrumenter) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	return context.WithValue(ctx, databaseQueryWrapperKey{}, time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *databaseQueryInstrumenter) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	h.instrument(ctx, "success", query, nil)

	return ctx, nil
}

func (h *databaseQueryInstrumenter) instrument(ctx context.Context, status string, query string, err error) {
	begin := ctx.Value(databaseQueryWrapperKey{}).(time.Time)
	elapsed := time.Since(begin)

	histogram := databaseQueryHistogram.WithLabelValues(status)
	if traceID := tracing.TraceIDFromContext(ctx, true); traceID != "" {
		// Need to type-convert the Observer to an
		// ExemplarObserver. This will always work for a
		// HistogramVec.
		histogram.(prometheus.ExemplarObserver).ObserveWithExemplar(
			elapsed.Seconds(), prometheus.Labels{"traceID": traceID},
		)
	} else {
		histogram.Observe(elapsed.Seconds())
	}

	ctx = log.IncDBCallCounter(ctx)

	_, span := h.tracer.Start(ctx, "database query")
	defer span.End()

	span.AddEvents([]string{"query", "status"}, []tracing.EventValue{{Str: query}, {Str: status}})

	if err != nil {
		span.AddEvents([]string{"error"}, []tracing.EventValue{{Str: err.Error()}})
	}

	ctxLogger := h.log.FromContext(ctx)
	ctxLogger.Debug("query finished", "status", status, "elapsed time", elapsed, "sql", query, "error", err)
}

// OnError will be called if any error happens
func (h *databaseQueryInstrumenter) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	// Not a user error: driver is telling sql package that an
	// optional interface method is not implemented. There is
	// nothing to instrument here.
	// https://golang.org/pkg/database/sql/driver/#ErrSkip
	// https://github.com/DataDog/dd-trace-go/issues/270
	if errors.Is(err, driver.ErrSkip) {
		return nil
	}

	status := "error"
	if err == nil {
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

// databaseQueryLogger satisfies the sqlhook.databaseQueryLogger interface
// It logs database queries.
type databaseQueryLogger struct {
	log log.Logger
}

func (h *databaseQueryLogger) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	return context.WithValue(ctx, "start", time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and logs the query, its args and its elapsed time
func (h *databaseQueryLogger) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	start := ctx.Value("start").(time.Time)

	ctxLogger := h.log.FromContext(ctx)
	ctxLogger.Info("[SQL]", "query", query, "args", args, "elapsed time", time.Since(start))
	return ctx, nil
}

// OnError will be called if any error happens
func (h *databaseQueryLogger) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	// Not a user error: driver is telling sql package that an
	// optional interface method is not implemented. There is
	// nothing to instrument here.
	// https://golang.org/pkg/database/sql/driver/#ErrSkip
	// https://github.com/DataDog/dd-trace-go/issues/270
	if errors.Is(err, driver.ErrSkip) {
		return nil
	}

	ctxLogger := h.log.FromContext(ctx)
	ctxLogger.Error("[SQL] failed", "query", query, "args", args, "err", err)
	return nil
}
