package sqlstore

import (
	"context"
	"crypto/md5"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"xorm.io/core"
)

var (
	databaseQueryCounter  *prometheus.CounterVec
	databaseQueryDuration *prometheus.SummaryVec
)

func init() {
	databaseQueryCounter = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "database_queries_total",
		Help:      "The total amount of Database queries",
	}, []string{"status"})

	databaseQueryDuration = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  "grafana",
		Name:       "database_queries_duration",
		Help:       "Database query duration",
		Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
	}, []string{"status"})

	prometheus.MustRegister(databaseQueryCounter, databaseQueryDuration)
}

// Hooks satisfies the sqlhook.Hooks interface
type Hooks struct{}

// Before hook will print the query with it's args and return the context with the timestamp
func (h *Hooks) Before(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	fmt.Printf("> %x", md5.Sum([]byte(query)))
	return context.WithValue(ctx, "begin", time.Now()), nil
}

// After hook will get the timestamp registered on the Before hook and print the elapsed time
func (h *Hooks) After(ctx context.Context, query string, args ...interface{}) (context.Context, error) {
	begin := ctx.Value("begin").(time.Time) //type check
	fmt.Printf(". took: %s\n", time.Since(begin))
	databaseQueryCounter.WithLabelValues("success").Inc()
	databaseQueryDuration.WithLabelValues("success").Observe(time.Since(begin).Seconds())
	return ctx, nil
}

// OnError instances will be called if any error happens
func (h *Hooks) OnError(ctx context.Context, err error, query string, args ...interface{}) error {
	begin := ctx.Value("begin").(time.Time) //type check
	databaseQueryCounter.WithLabelValues("error").Inc()
	databaseQueryDuration.WithLabelValues("error").Observe(time.Since(begin).Seconds())
	return nil
}

type HookParser struct {
	dbType string
}

func (hp *HookParser) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{
		DbType: core.DbType(hp.dbType),
	}, nil
}
