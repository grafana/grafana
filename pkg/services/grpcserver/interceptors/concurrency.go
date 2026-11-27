package interceptors

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
)

// ConcurrencyMetrics records how many requests of the same route were already
// running when each gRPC request arrived. Unlike an in-flight gauge, which only
// shows concurrency at scrape time, it keeps bursts that end between scrapes.
type ConcurrencyMetrics struct {
	atArrival *prometheus.HistogramVec
	routes    sync.Map // route -> *routeConcurrency
}

type routeConcurrency struct {
	running   atomic.Int64
	atArrival prometheus.Observer
}

// NewConcurrencyMetrics creates the concurrency metrics. A nil registerer
// leaves them unregistered.
func NewConcurrencyMetrics(reg prometheus.Registerer) *ConcurrencyMetrics {
	return &ConcurrencyMetrics{
		atArrival: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                            "grafana_grpc_requests_in_flight_at_arrival",
			Help:                            "gRPC requests of the same route already being handled when a request arrives, including requests later rejected by authentication.",
			Buckets:                         []float64{0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000},
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"route"}),
	}
}

// Routes are the server's registered full method names, so the label set is
// bounded by the services registered on it.
func (m *ConcurrencyMetrics) route(route string) *routeConcurrency {
	if rc, ok := m.routes.Load(route); ok {
		return rc.(*routeConcurrency)
	}
	rc, _ := m.routes.LoadOrStore(route, &routeConcurrency{
		atArrival: m.atArrival.WithLabelValues(route),
	})
	return rc.(*routeConcurrency)
}

func (m *ConcurrencyMetrics) start(route string) *routeConcurrency {
	rc := m.route(route)
	rc.atArrival.Observe(float64(rc.running.Add(1) - 1))
	return rc
}

func (rc *routeConcurrency) finish() {
	rc.running.Add(-1)
}

// UnaryConcurrencyInterceptor records unary request concurrency.
func UnaryConcurrencyInterceptor(m *ConcurrencyMetrics) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		defer m.start(info.FullMethod).finish()
		return handler(ctx, req)
	}
}

// StreamConcurrencyInterceptor records streaming request concurrency.
func StreamConcurrencyInterceptor(m *ConcurrencyMetrics) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		defer m.start(info.FullMethod).finish()
		return handler(srv, ss)
	}
}
