package debouncer

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ErrBufferFull = errors.New("debouncer buffer full")
)

type KeyFunc[T any] func(T) string
type ProcessFunc[T any] func(context.Context, T) error

type metrics struct {
	itemsAddedCounter           prometheus.Counter
	itemsDroppedCounter         prometheus.Counter
	itemsProcessedCounter       prometheus.Counter
	processingErrorsCounter     prometheus.Counter
	processingDurationHistogram prometheus.Histogram
}

func newMetrics(reg prometheus.Registerer, name string) *metrics {
	return &metrics{
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

type DebouncerOpts[T any] struct {
	BufferSize   int
	KeyFunc      KeyFunc[T]
	MinWait      time.Duration
	MaxWait      time.Duration
	Reg          prometheus.Registerer
	Name         string
	ErrorHandler func(T, error)
}

type Debouncer[T any] struct {
	opts   DebouncerOpts[T]
	buffer chan T

	// mutex protecting the debouncers map.
	debouncersMu sync.Mutex
	debouncers   map[string]*keyDebouncer[T]

	wg           sync.WaitGroup
	ctx          context.Context
	cancel       context.CancelFunc
	errorHandler func(T, error)
	metrics      *metrics
}

// NewDebouncer creates a new debouncer for processing events with unique keys.
//
// A debouncer helps optimize expensive operations by:
// 1. Grouping identical events that occur in rapid succession
// 2. Processing each unique key only once after waiting periods expire
//
// Parameters:
//   - BufferSize: Maximum number of pending events to buffer
//   - KeyFunc: Function that extracts/defines the key from an input
//   - MinWait: Cooldown period after receiving an event. If another event with the
//     same key arrives during this period, the timer resets and we wait another MinWait duration.
//   - MaxWait: Maximum time any event will wait before processing. Even if new events
//     for the same key keep arriving, we guarantee processing after MaxWait from the first event.
//
// Example usage:
//
//	debouncer := NewDebouncer(DebouncerOpts[string]{
//		BufferSize: 10,
//		KeyFunc:    func(s string) string { return s },
//		MinWait:    time.Second * 10,
//		MaxWait:    time.Minute,
//	})
//
//	debouncer.Start(ctx, func(key string) error {
//		// This is where you perform the expensive operation
//		return doSuperExpensiveCommand(key)
//	})
//
//	// Queue events
//	debouncer.Add("user-1")
//	// Adding the same key resets MinWait but not MaxWait
//	debouncer.Add("user-1")
//
// The event will be processed when either MinWait expires (after the most recent add)
// or MaxWait expires (after the first add), whichever comes first.
func NewDebouncer[T any](opts DebouncerOpts[T]) *Debouncer[T] {
	if opts.BufferSize <= 0 {
		opts.BufferSize = 100
	}
	if opts.MinWait <= 0 {
		opts.MinWait = time.Minute
	}
	if opts.MaxWait <= 0 {
		opts.MaxWait = 5 * time.Minute
	}
	if opts.KeyFunc == nil {
		panic("KeyFunc is required")
	}

	if opts.Reg == nil {
		opts.Reg = prometheus.NewRegistry()
	}

	return &Debouncer[T]{
		opts:         opts,
		buffer:       make(chan T, opts.BufferSize),
		debouncers:   make(map[string]*keyDebouncer[T]),
		metrics:      newMetrics(opts.Reg, opts.Name),
		errorHandler: opts.ErrorHandler,
	}
}

func (d *Debouncer[T]) Add(value T) error {
	select {
	case d.buffer <- value:
		d.metrics.itemsAddedCounter.Inc()
		return nil
	default:
		d.metrics.itemsDroppedCounter.Inc()
		return ErrBufferFull
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
	d.opts.MinWait = minWait
}

func (d *Debouncer[T]) SetMaxWait(maxWait time.Duration) {
	d.opts.MaxWait = maxWait
}

func (d *Debouncer[T]) processValue(value T, processFunc ProcessFunc[T]) {
	key := d.opts.KeyFunc(value)
	d.debouncersMu.Lock()
	defer d.debouncersMu.Unlock()

	debouncer, ok := d.debouncers[key]
	if !ok {
		debouncer = newKeyDebouncer[T](d.opts.MinWait, d.opts.MaxWait)
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

// keyDebouncer handles debouncing for a specific key.
type keyDebouncer[T any] struct {
	// mutex that protects the whole debouncer process.
	mu       sync.Mutex
	value    T
	minTimer *time.Timer
	maxTimer *time.Timer
	minWait  time.Duration
	maxWait  time.Duration
}

// newKeyDebouncer creates a new key debouncer.
func newKeyDebouncer[T any](minWait, maxWait time.Duration) *keyDebouncer[T] {
	return &keyDebouncer[T]{
		minWait: minWait,
		maxWait: maxWait,
	}
}

// update updates the debouncer with a new value.
func (d *keyDebouncer[T]) update(value T, processFunc func(T)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.value = value

	if d.minTimer != nil {
		d.minTimer.Stop()
	}
	d.minTimer = time.AfterFunc(d.minWait, func() {
		d.process(processFunc)
	})

	// Ensure max timer is only set once.
	if d.maxTimer == nil {
		d.maxTimer = time.AfterFunc(d.maxWait, func() {
			d.process(processFunc)
		})
	}
}

// process processes the current value.
func (d *keyDebouncer[T]) process(processFunc func(T)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Stop timers and clear references.
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
