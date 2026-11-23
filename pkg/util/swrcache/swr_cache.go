// Package swrcache is an in-memory LRU cache that serves stale values while it refreshes them, so
// that callers keep working through slow or failing loads.
package swrcache

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"runtime/debug"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/simplelru"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

// Loader loads the value for key. ctx keeps the values of the context of the Get that started
// the load, but not its cancellation, and carries Options.LoadTimeout as its deadline. A load
// serves every concurrent caller of that key, so the result must depend on key alone, not on who
// is calling. Because ctx keeps every value of the starting Get's context and the load can outlive
// that request, the loader must not use request-scoped resources from ctx, such as a database
// session or transaction.
type Loader[K comparable, V any] func(ctx context.Context, key K) (V, error)

// ErrLoaderPanic is wrapped by the error Get returns when the loader panics or exits its goroutine
// without returning.
var ErrLoaderPanic = errors.New("swrcache: loader panicked")

var errLoaderExited = fmt.Errorf("%w: loader exited without returning", ErrLoaderPanic)

var metricNamePattern = regexp.MustCompile("^[a-zA-Z_][a-zA-Z0-9_]*$")

type Options struct {
	// MetricsPrefix starts every metric name and span name, e.g. "settings_store_cache" gives
	// "settings_store_cache_requests_total". It must be unique among caches registered with one
	// registry.
	MetricsPrefix string
	// TTL is the maximum age of an entry since its last successful load. The cache checks the age
	// when a read starts, so a read that then waits for a refresh can return a value up to
	// StaleWait older than TTL.
	TTL time.Duration
	// RefreshInterval is the age after which an entry is stale and a read refreshes it.
	RefreshInterval time.Duration
	// MinRefreshInterval is the minimum time between two age-based refreshes of one key. Reads in
	// between serve the stale entry without loading. MarkStale lifts the limit for the next read.
	// Zero means no limit.
	MinRefreshInterval time.Duration
	// StaleWait bounds how long a read of a stale entry waits for its refresh. Zero means the read
	// returns the old value at once and the refresh runs on.
	StaleWait time.Duration
	// LoadTimeout bounds each loader call.
	LoadTimeout time.Duration
	// MaxEntries is the LRU capacity.
	MaxEntries int
	// Logger is optional. Pass nil to disable logging: log.NewNopLogger() is not a safe no-op,
	// because its FromContext hands off to the root logger when ctx carries trace fields.
	Logger log.Logger
	// Tracer is optional; nil records no spans.
	Tracer trace.Tracer
}

// Validate requires MetricsPrefix to match ^[a-zA-Z_][a-zA-Z0-9_]*$, TTL, RefreshInterval,
// LoadTimeout and MaxEntries to be greater than zero, StaleWait and MinRefreshInterval not to be
// negative, and MinRefreshInterval <= RefreshInterval <= TTL. Errors name the offending field.
func (o Options) Validate() error {
	if !metricNamePattern.MatchString(o.MetricsPrefix) {
		return fmt.Errorf("swrcache: MetricsPrefix %q is not a valid metric name", o.MetricsPrefix)
	}
	positive := []struct {
		field string
		value int64
	}{
		{"TTL", int64(o.TTL)},
		{"RefreshInterval", int64(o.RefreshInterval)},
		{"LoadTimeout", int64(o.LoadTimeout)},
		{"MaxEntries", int64(o.MaxEntries)},
	}
	for _, item := range positive {
		if item.value <= 0 {
			return fmt.Errorf("swrcache: %s must be greater than zero", item.field)
		}
	}
	nonNegative := []struct {
		field string
		value time.Duration
	}{
		{"MinRefreshInterval", o.MinRefreshInterval},
		{"StaleWait", o.StaleWait},
	}
	for _, item := range nonNegative {
		if item.value < 0 {
			return fmt.Errorf("swrcache: %s must not be negative", item.field)
		}
	}
	if o.MinRefreshInterval > o.RefreshInterval {
		return errors.New("swrcache: MinRefreshInterval must not exceed RefreshInterval")
	}
	if o.RefreshInterval > o.TTL {
		return errors.New("swrcache: RefreshInterval must not exceed TTL")
	}
	return nil
}

type flight[V any] struct {
	done  chan struct{} // closed once value and err are final
	value V
	err   error
}

type entry[V any] struct {
	value            V
	loaded           bool      // false until a successful load; reset to false when the entry expires
	loadedAt         time.Time // time of the last successful load
	stale            bool
	gen              uint64    // incremented by MarkStale; detects invalidations during a load
	lastRefreshStart time.Time // zero means no throttle
}

// Cache is an in-memory LRU cache that is safe for concurrent use. A read of an entry older than
// RefreshInterval, or marked stale, refreshes it: the read waits up to StaleWait for the new value
// and otherwise returns the old one. When a refresh fails, reads keep getting the old value until
// TTL. Each key has at most one load running, and the cache refreshes only on reads; it starts no
// background work. Loads of different keys run concurrently without a limit, and a load keeps
// running for up to LoadTimeout after its callers stop waiting. Values are shared between callers
// and must be treated as read only.
//
// Cache is a prometheus.Collector for its own metrics; the caller registers it.
type Cache[K comparable, V any] struct {
	mu      sync.Mutex // guards entries and flights
	entries *simplelru.LRU[K, *entry[V]]
	flights map[K]*flight[V]
	load    Loader[K, V]
	opts    Options
	metrics metrics
	logger  log.Logger
	tracer  trace.Tracer
}

var _ prometheus.Collector = (*Cache[string, int])(nil)

// New fails when load is nil or opts is invalid. It does not register the metrics.
func New[K comparable, V any](load Loader[K, V], opts Options) (*Cache[K, V], error) {
	if load == nil {
		return nil, errors.New("swrcache: loader must not be nil")
	}
	if err := opts.Validate(); err != nil {
		return nil, err
	}
	entries, err := simplelru.NewLRU[K, *entry[V]](opts.MaxEntries, nil)
	if err != nil {
		return nil, err
	}
	cache := &Cache[K, V]{
		entries: entries,
		flights: make(map[K]*flight[V]),
		load:    load,
		opts:    opts,
		logger:  opts.Logger,
		tracer:  opts.Tracer,
	}
	if cache.logger == nil {
		cache.logger = nopLogger{}
	}
	if cache.tracer == nil {
		cache.tracer = noop.NewTracerProvider().Tracer("")
	}
	cache.metrics = newMetrics(opts.MetricsPrefix, cache.Len)
	return cache, nil
}

// nopLogger is the default logger. log.NewNopLogger() is not a safe default: its New hands off to
// the global root logger, and FromContext calls New when ctx carries trace fields.
type nopLogger struct{}

func (nopLogger) Debug(string, ...any)                   {}
func (nopLogger) Info(string, ...any)                    {}
func (nopLogger) Warn(string, ...any)                    {}
func (nopLogger) Error(string, ...any)                   {}
func (nopLogger) Log(...any) error                       { return nil }
func (nopLogger) FromContext(context.Context) log.Logger { return nopLogger{} }
func (nopLogger) New(...any) *log.ConcreteLogger         { return log.NewNopLogger() }

const (
	loadSuccess = "success"
	loadError   = "error"

	resultAttribute = "swrcache.result"
)

type metrics struct {
	requests     *prometheus.CounterVec
	loadDuration *prometheus.HistogramVec
	entries      prometheus.GaugeFunc
}

func newMetrics(prefix string, entries func() int) metrics {
	created := metrics{
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: prefix + "_requests_total",
			Help: "Cache reads, by the path they took.",
		}, []string{"result"}),
		loadDuration: metricutil.NewHistogramVec(prometheus.HistogramOpts{
			Name:    prefix + "_load_duration_seconds",
			Help:    "Duration of loader calls, by result.",
			Buckets: prometheus.DefBuckets,
		}, []string{"result"}),
		entries: prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Name: prefix + "_entries",
			Help: "Number of entries in the cache.",
		}, func() float64 { return float64(entries()) }),
	}
	for _, result := range []string{resultFresh, resultRefreshed, resultStaleTimeout, resultStaleError, resultStaleThrottled, resultStaleCancelled, resultMiss, resultCancelled} {
		created.requests.WithLabelValues(result)
	}
	for _, result := range []string{loadSuccess, loadError} {
		created.loadDuration.WithLabelValues(result)
	}
	return created
}

func (c *Cache[K, V]) Describe(descs chan<- *prometheus.Desc) {
	c.metrics.requests.Describe(descs)
	c.metrics.loadDuration.Describe(descs)
	c.metrics.entries.Describe(descs)
}

func (c *Cache[K, V]) Collect(metrics chan<- prometheus.Metric) {
	c.metrics.requests.Collect(metrics)
	c.metrics.loadDuration.Collect(metrics)
	c.metrics.entries.Collect(metrics)
}

const (
	resultFresh          = "fresh"
	resultRefreshed      = "refreshed"
	resultStaleTimeout   = "stale_timeout"
	resultStaleError     = "stale_error"
	resultStaleThrottled = "stale_throttled"
	resultMiss           = "miss"
	resultCancelled      = "cancelled"
	resultStaleCancelled = "stale_cancelled"
)

// Get returns the value for key, loading it when needed. The value is shared with other callers
// and must not be modified. A failed load is not cached: while the loader keeps failing for a key
// that has no value, every Get calls it again (concurrent Gets share one call). A caller whose
// ctx ends while it waits for a refresh gets the old value.
func (c *Cache[K, V]) Get(ctx context.Context, key K) (V, error) {
	value, result, err := c.get(ctx, key)
	c.metrics.requests.WithLabelValues(result).Inc()
	return value, err
}

func (c *Cache[K, V]) get(ctx context.Context, key K) (V, string, error) {
	var zero, oldValue V
	stale := false

	// Classification, the throttle decision and flight creation share one critical section, so a
	// flight that finished a moment ago is always visible as a fresh entry.
	c.mu.Lock()
	e, found := c.entries.Get(key)
	if found && e.loaded {
		age := time.Since(e.loadedAt)
		switch {
		case age >= c.opts.TTL:
			// Reset in place: a refresh that is still running stores its result into this entry.
			e.loaded = false
			e.value = zero
		case !e.stale && age < c.opts.RefreshInterval:
			value := e.value
			c.mu.Unlock()
			return value, resultFresh, nil
		default:
			stale = true
			oldValue = e.value
		}
	}
	if stale {
		now := time.Now()
		if !e.lastRefreshStart.IsZero() && now.Sub(e.lastRefreshStart) < c.opts.MinRefreshInterval {
			c.mu.Unlock()
			return oldValue, resultStaleThrottled, nil
		}
		e.lastRefreshStart = now
	}
	flt, running := c.flights[key]
	if !running {
		if !found {
			e = &entry[V]{}
			c.entries.Add(key, e)
		}
		flt = &flight[V]{done: make(chan struct{})}
		c.flights[key] = flt
		go c.run(ctx, key, e, e.gen, flt)
	}
	c.mu.Unlock()

	if stale {
		timer := time.NewTimer(c.opts.StaleWait)
		defer timer.Stop()
		select {
		case <-flt.done:
			if flt.err != nil {
				return oldValue, resultStaleError, nil
			}
			return flt.value, resultRefreshed, nil
		case <-timer.C:
			return oldValue, resultStaleTimeout, nil
		case <-ctx.Done():
			return oldValue, resultStaleCancelled, nil
		}
	}
	select {
	case <-flt.done:
		return flt.value, resultMiss, flt.err
	case <-ctx.Done():
		return zero, resultCancelled, ctx.Err()
	}
}

// run calls the loader for key, stores the result into e when e is still the entry for key, and
// completes flt. It runs in the flight goroutine. gen is e.gen when the flight started.
func (c *Cache[K, V]) run(ctx context.Context, key K, e *entry[V], gen uint64, flt *flight[V]) {
	loadCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), c.opts.LoadTimeout)
	defer cancel()
	spanCtx, span := c.tracer.Start(loadCtx, c.opts.MetricsPrefix+".load")
	start := time.Now()

	var (
		value     V
		err       error
		returned  bool
		recovered any
		stack     []byte
	)
	// Deferred so that it runs on success, on error, on a panic and when the loader calls
	// runtime.Goexit. Whatever happens, the flight completes and leaves c.flights.
	defer func() {
		if !returned {
			// A Goexit leaves recovered nil; the goroutine keeps unwinding after this function.
			if recovered = recover(); recovered != nil {
				stack = debug.Stack()
				err = fmt.Errorf("%w: %v", ErrLoaderPanic, recovered)
			} else {
				err = errLoaderExited
			}
		}
		if err != nil {
			var zero V
			value = zero
		}

		warn, dropped := false, false
		c.mu.Lock()
		if current, ok := c.entries.Peek(key); ok && current == e {
			if err == nil {
				e.value, e.loaded, e.loadedAt = value, true, time.Now()
				e.stale = e.gen != gen
			}
			if !e.loaded {
				c.entries.Remove(key)
			} else if e.gen != gen {
				// A read that joined this load set the throttle after a MarkStale.
				e.lastRefreshStart = time.Time{}
			}
			warn = err != nil && e.loaded
		} else {
			dropped = err == nil
		}
		flt.value, flt.err = value, err
		delete(c.flights, key)
		c.mu.Unlock()

		result := loadSuccess
		if err != nil {
			result = loadError
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		c.metrics.loadDuration.WithLabelValues(result).Observe(time.Since(start).Seconds())
		span.SetAttributes(attribute.String(resultAttribute, result))
		span.End()

		logger := c.logger.FromContext(spanCtx)
		if recovered != nil {
			logger.Error("swrcache loader panicked", "cache", c.opts.MetricsPrefix, "key", key, "panic", recovered, "stack", string(stack))
		}
		if warn {
			logger.Warn("swrcache refresh failed, serving stale value", "cache", c.opts.MetricsPrefix, "key", key, "error", err)
		}
		if dropped {
			// Only get adds entries and each key has one flight, so eviction is the only cause.
			logger.Debug("swrcache dropped a load result for an evicted key", "cache", c.opts.MetricsPrefix, "key", key)
		}
		// Last, so that a caller that returns from Get can observe the metrics, span and logs.
		close(flt.done)
	}()

	value, err = c.load(spanCtx, key)
	returned = true
}

// MarkStale makes the next read of key refresh it, regardless of MinRefreshInterval. That read
// returns the new value only if the refresh finishes within StaleWait; otherwise it returns the
// old value. A load already running for key stores its result as stale, so the change that caused
// the call is not lost. Reads that arrive while that load runs join it and can still receive the
// value it loads, which may predate the change; the read after the load refreshes again. A key not
// in the cache is ignored.
func (c *Cache[K, V]) MarkStale(key K) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.entries.Peek(key); ok {
		markStale(e)
	}
}

// MarkAllStale is MarkStale for every key.
func (c *Cache[K, V]) MarkAllStale() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, e := range c.entries.Values() {
		markStale(e)
	}
}

func markStale[V any](e *entry[V]) {
	e.gen++
	e.stale = true
	e.lastRefreshStart = time.Time{}
}

// Len returns the number of entries. It includes entries whose first load is still running and
// expired entries that no read has touched since they expired.
func (c *Cache[K, V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.entries.Len()
}
