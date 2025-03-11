package util

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// KeyFunc is a function that returns a string key for a value
type KeyFunc[T any] func(T) string

// ProcessFunc is a function that processes a value
type ProcessFunc[T any] func(ctx context.Context, value T) error

// debouncerMetrics holds metrics for the debouncer
type debouncerMetrics struct {
	// itemsAddedCounter counts the number of items added to the debouncer
	itemsAddedCounter prometheus.Counter
	// itemsDroppedCounter counts the number of items dropped due to a full buffer
	itemsDroppedCounter prometheus.Counter
	// itemsProcessedCounter counts the number of items processed
	itemsProcessedCounter prometheus.Counter
	// processingErrorsCounter counts the number of errors during processing
	processingErrorsCounter prometheus.Counter
	// processingDurationHistogram measures the time taken to process items
	processingDurationHistogram prometheus.Histogram
}

// newDebouncerMetrics creates a new set of metrics for the debouncer
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

// DebouncerCfg contains options for creating a new Debouncer
type DebouncerCfg[T any] struct {
	// BufferSize is the size of the buffer for incoming items
	BufferSize int
	// KeyFunc is a function that returns a string key for a value
	KeyFunc KeyFunc[T]
	// MinWait is the minimum time to wait before processing the same key again
	MinWait time.Duration
	// MaxWait is the maximum time to wait before processing a key
	MaxWait time.Duration
	// MetricsRegisterer is the registerer for metrics
	MetricsRegisterer prometheus.Registerer
	// Name is the name prefix for metrics
	Name string
	// ErrorHandler is a function that handles errors during processing
	ErrorHandler func(T, error)
}

// Debouncer is a utility for debouncing events
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

// NewDebouncer creates a new debouncer with the given buffer size
func NewDebouncer[T any](cfg DebouncerCfg[T]) *Debouncer[T] {
	// Set default values
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

	// Create metrics if registerer and name are provided
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

// Add adds a value to the buffer
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

// Start starts the debouncer with the given process function
func (d *Debouncer[T]) Start(ctx context.Context, processFunc func(context.Context, T) error) {
	d.ctx, d.cancel = context.WithCancel(ctx)
	d.wg.Add(1)
	go d.worker(processFunc)
}

// Stop stops the debouncer
func (d *Debouncer[T]) Stop() {
	if d.cancel != nil {
		d.cancel()
		d.wg.Wait()
	}
}

// SetMinWait sets the minimum wait time
func (d *Debouncer[T]) SetMinWait(minWait time.Duration) {
	d.cfg.MinWait = minWait
}

// SetMaxWait sets the maximum wait time
func (d *Debouncer[T]) SetMaxWait(maxWait time.Duration) {
	d.cfg.MaxWait = maxWait
}

// worker processes values from the buffer
func (d *Debouncer[T]) worker(processFunc func(context.Context, T) error) {
	defer d.wg.Done()

	for {
		select {
		case <-d.ctx.Done():
			return
		case value := <-d.buffer:
			d.processValue(value, processFunc)
		}
	}
}

// processValue processes a value
func (d *Debouncer[T]) processValue(value T, processFunc func(context.Context, T) error) {
	key := d.cfg.KeyFunc(value)
	d.debouncersMu.Lock()
	defer d.debouncersMu.Unlock()

	// Get or create a debouncer for this key
	debouncer, ok := d.debouncers[key]
	if !ok {
		debouncer = newKeyDebouncer[T](d.cfg.MinWait, d.cfg.MaxWait)
		d.debouncers[key] = debouncer
	}

	// Update the debouncer with the new value
	debouncer.update(value, func(v T) {
		d.processWithMetrics(d.ctx, v, key, processFunc)
	})
}

// processWithMetrics wraps the process function with metrics
func (d *Debouncer[T]) processWithMetrics(ctx context.Context, value T, key string, processFunc func(context.Context, T) error) {
	if d.metrics != nil {
		timer := prometheus.NewTimer(d.metrics.processingDurationHistogram)
		defer timer.ObserveDuration()
		d.metrics.itemsProcessedCounter.Inc()
	}

	// Process the value
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
		minTimer: time.NewTimer(0),
		maxTimer: time.NewTimer(0),
		minWait:  minWait,
		maxWait:  maxWait,
	}
}

// update updates the debouncer with a new value
func (d *keyDebouncer[T]) update(value T, processFunc func(T)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Store the value
	d.value = value

	// Stop and drain the min timer if it's active
	if !d.minTimer.Stop() {
		select {
		case <-d.minTimer.C:
		default:
		}
	}

	// Reset the min timer with the configured minWait
	d.minTimer.Reset(d.minWait)

	// If the max timer is not active, start it
	if d.maxTimer.Stop() {
		// Reset the max timer
		d.maxTimer.Reset(d.maxWait)

		// Start a goroutine to process after max wait
		go func() {
			<-d.maxTimer.C
			d.process(processFunc)
		}()
	}

	// Start a goroutine to process after min wait
	go func() {
		<-d.minTimer.C
		d.process(processFunc)
	}()
}

// process processes the current value
func (d *keyDebouncer[T]) process(processFunc func(T)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Stop the timers
	d.minTimer.Stop()
	d.maxTimer.Stop()

	// Process the value
	processFunc(d.value)
}
