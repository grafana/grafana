package util

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type KeyFunc[T any] func(T) string
type ProcessFunc[T any] func(context.Context, T) error

type debouncerMetrics struct {
	itemsAddedCounter           prometheus.Counter
	itemsDroppedCounter         prometheus.Counter
	itemsProcessedCounter       prometheus.Counter
	processingErrorsCounter     prometheus.Counter
	processingDurationHistogram prometheus.Histogram
}

func newDebouncerMetrics(reg prometheus.Registerer, name string) *debouncerMetrics {
	return &debouncerMetrics{
		itemsAddedCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: name + "_debouncer_items_added_total",
			Help: "Total number of items added to the debouncer",
		}),
		itemsDroppedCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: name + "_debouncer_items_dropped_total",
			Help: "Total number of items dropped due to a full buffer",
		}),
		itemsProcessedCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: name + "_debouncer_items_processed_total",
			Help: "Total number of items processed by the debouncer",
		}),
		processingErrorsCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: name + "_debouncer_processing_errors_total",
			Help: "Total number of errors during processing",
		}),
		processingDurationHistogram: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:    name + "_debouncer_processing_duration_seconds",
			Help:    "Time taken to process items",
			Buckets: prometheus.DefBuckets,
		}),
	}
}

type DebouncerCfg[T any] struct {
	BufferSize        int
	KeyFunc           KeyFunc[T]
	MinWait           time.Duration
	MaxWait           time.Duration
	MetricsRegisterer prometheus.Registerer
	Name              string
	ErrorHandler      func(T, error)
}

type Debouncer[T any] struct {
	cfg          DebouncerCfg[T]
	buffer       chan T
	debouncers   map[string]*keyDebouncer[T]
	debouncersMu sync.Mutex
	wg           sync.WaitGroup
	ctx          context.Context
	cancel       context.CancelFunc
	metrics      *debouncerMetrics
	errorHandler func(T, error)
}

func NewDebouncer[T any](cfg DebouncerCfg[T]) *Debouncer[T] {
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = 100
	}
	if cfg.MinWait <= 0 {
		cfg.MinWait = time.Minute
	}
	if cfg.MaxWait <= 0 {
		cfg.MaxWait = 5 * time.Minute
	}
	if cfg.KeyFunc == nil {
		panic("KeyFunc is required")
	}

	var metrics *debouncerMetrics
	if cfg.MetricsRegisterer != nil && cfg.Name != "" {
		metrics = newDebouncerMetrics(cfg.MetricsRegisterer, cfg.Name)
	}

	return &Debouncer[T]{
		cfg:          cfg,
		buffer:       make(chan T, cfg.BufferSize),
		debouncers:   make(map[string]*keyDebouncer[T]),
		metrics:      metrics,
		errorHandler: cfg.ErrorHandler,
	}
}

func (d *Debouncer[T]) Add(value T) bool {
	select {
	case d.buffer <- value:
		if d.metrics != nil {
			d.metrics.itemsAddedCounter.Inc()
		}
		return true
	default:
		if d.metrics != nil {
			d.metrics.itemsDroppedCounter.Inc()
		}
		return false
	}
}

func (d *Debouncer[T]) Start(ctx context.Context, processFunc ProcessFunc[T]) {
	d.ctx, d.cancel = context.WithCancel(ctx)
	d.wg.Add(1)
	go func() {
		defer d.wg.Done()
		for {
			select {
			case <-d.ctx.Done():
				return
			case value := <-d.buffer:
				d.processValue(value, processFunc)
			}
		}
	}()
}

func (d *Debouncer[T]) Stop() {
	if d.cancel != nil {
		d.cancel()
		d.wg.Wait()
	}
}

func (d *Debouncer[T]) SetMinWait(minWait time.Duration) {
	d.cfg.MinWait = minWait
}

func (d *Debouncer[T]) SetMaxWait(maxWait time.Duration) {
	d.cfg.MaxWait = maxWait
}

func (d *Debouncer[T]) processValue(value T, processFunc ProcessFunc[T]) {
	key := d.cfg.KeyFunc(value)
	d.debouncersMu.Lock()
	defer d.debouncersMu.Unlock()

	debouncer, ok := d.debouncers[key]
	if !ok {
		debouncer = newKeyDebouncer[T](d.cfg.MinWait, d.cfg.MaxWait)
		d.debouncers[key] = debouncer
	}

	wrappedProcessFunc := func(v T) {
		d.processWithMetrics(d.ctx, v, key, processFunc)

		d.debouncersMu.Lock()
		defer d.debouncersMu.Unlock()
		if current, exists := d.debouncers[key]; exists && current == debouncer {
			delete(d.debouncers, key)
		}
	}

	debouncer.update(value, wrappedProcessFunc)
}

func (d *Debouncer[T]) processWithMetrics(ctx context.Context, value T, key string, processFunc ProcessFunc[T]) {
	if d.metrics != nil {
		timer := prometheus.NewTimer(d.metrics.processingDurationHistogram)
		defer timer.ObserveDuration()
		d.metrics.itemsProcessedCounter.Inc()
	}

	err := processFunc(ctx, value)
	if err != nil && d.errorHandler != nil {
		d.errorHandler(value, err)
		if d.metrics != nil {
			d.metrics.processingErrorsCounter.Inc()
		}
	}
}

// keyDebouncer handles debouncing for a specific key
type keyDebouncer[T any] struct {
	value    T
	minTimer *time.Timer
	maxTimer *time.Timer
	minWait  time.Duration
	maxWait  time.Duration
	mu       sync.Mutex
}

// newKeyDebouncer creates a new key debouncer
func newKeyDebouncer[T any](minWait, maxWait time.Duration) *keyDebouncer[T] {
	return &keyDebouncer[T]{
		minWait: minWait,
		maxWait: maxWait,
	}
}

// update updates the debouncer with a new value
func (d *keyDebouncer[T]) update(value T, processFunc func(T)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.value = value

	// Reset min timer
	if d.minTimer != nil {
		d.minTimer.Stop()
	}
	d.minTimer = time.AfterFunc(d.minWait, func() {
		d.process(processFunc)
	})

	// Ensure max timer is only set once per burst
	if d.maxTimer == nil {
		d.maxTimer = time.AfterFunc(d.maxWait, func() {
			d.process(processFunc)
		})
	}
}

// process processes the current value
func (d *keyDebouncer[T]) process(processFunc func(T)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Stop timers and clear references
	if d.minTimer != nil {
		d.minTimer.Stop()
		d.minTimer = nil
	}
	if d.maxTimer != nil {
		d.maxTimer.Stop()
		d.maxTimer = nil
	}

	processFunc(d.value)
}
