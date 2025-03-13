package debouncer

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ErrBufferFull = errors.New("debouncer buffer full")
)

type KeyFunc[T any] func(T) string
type ProcessFunc[T any] func(context.Context, T) error
type ErrorFunc[T any] func(T, error)

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
			Name: "debouncer_items_added_total",
			Help: "Total number of items added to the debouncer",
			ConstLabels: prometheus.Labels{
				"name": name,
			},
		}),
		itemsDroppedCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "debouncer_items_dropped_total",
			Help: "Total number of items dropped due to a full buffer",
			ConstLabels: prometheus.Labels{
				"name": name,
			},
		}),
		itemsProcessedCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "debouncer_items_processed_total",
			Help: "Total number of items processed by the debouncer",
			ConstLabels: prometheus.Labels{
				"name": name,
			},
		}),
		processingErrorsCounter: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "debouncer_processing_errors_total",
			Help: "Total number of errors during processing",
			ConstLabels: prometheus.Labels{
				"name": name,
			},
		}),
		processingDurationHistogram: promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
			Name:                            "debouncer_processing_duration_seconds",
			Help:                            "Time taken to process items",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     1.1,
			NativeHistogramMaxBucketNumber:  160,
			NativeHistogramMinResetDuration: time.Hour,
			ConstLabels: prometheus.Labels{
				"name": name,
			},
		}),
	}
}

type DebouncerOpts[T any] struct {
	BufferSize     int
	KeyFunc        KeyFunc[T]
	MinWait        time.Duration
	MaxWait        time.Duration
	Reg            prometheus.Registerer
	Name           string
	ErrorHandler   ErrorFunc[T]
	ProcessHandler ProcessFunc[T]
}

type Group[T any] struct {
	opts   DebouncerOpts[T]
	buffer chan T

	// mutex protecting the debouncers map.
	debouncersMu sync.Mutex
	debouncers   map[string]*debouncer[T]

	wg             sync.WaitGroup
	ctx            context.Context
	cancel         context.CancelFunc
	errorHandler   ErrorFunc[T]
	processHandler ProcessFunc[T]
	metrics        *metrics
}

// NewGroup creates a new debouncer group for processing events with unique keys.
//
// A debouncer group helps optimize expensive operations by:
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
//	group := debouncer.NewGroup(DebouncerOpts[string]{
//		BufferSize:     1000,
//		KeyFunc:        func(s string) string { return s },
//		ProcessHandler: func(ctx context.Context, key string) error {
//		  // This is where you perform the expensive operation
//		  return doSuperExpensiveCommand(key)
//		}
//		MinWait:        time.Second * 10,
//		MaxWait:        time.Minute,
//	})
//
//	// Start the debouncer group.
//	group.Start(ctx)
//
//	// Queue events
//	if err := group.Add("user-1"); err != nil {
//	  // Do something with the error.
//	}
//	// Adding the same key resets MinWait but not MaxWait
//	if err := group.Add("user-1"); err != nil {
//	  // Do something with the error.
//	}
//
// The event will be processed when either MinWait expires (after the most recent add)
// or MaxWait expires (after the first add), whichever comes first.
func NewGroup[T any](opts DebouncerOpts[T]) (*Group[T], error) {
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
		return nil, errors.New("keyFunc is required")
	}

	if opts.ProcessHandler == nil {
		return nil, errors.New("processHandler is required")
	}

	if opts.ErrorHandler == nil {
		opts.ErrorHandler = func(_ T, _ error) {}
	}

	if opts.Reg == nil {
		opts.Reg = prometheus.NewRegistry()
	}

	return &Group[T]{
		opts:           opts,
		buffer:         make(chan T, opts.BufferSize),
		debouncers:     make(map[string]*debouncer[T]),
		metrics:        newMetrics(opts.Reg, opts.Name),
		processHandler: opts.ProcessHandler,
		errorHandler:   opts.ErrorHandler,
	}, nil
}

func (g *Group[T]) Add(value T) error {
	select {
	case g.buffer <- value:
		g.metrics.itemsAddedCounter.Inc()
		return nil
	default:
		g.metrics.itemsDroppedCounter.Inc()
		return ErrBufferFull
	}
}

func (g *Group[T]) Start(ctx context.Context) {
	g.ctx, g.cancel = context.WithCancel(ctx)
	g.wg.Add(1)
	go func() {
		defer g.wg.Done()
		for {
			select {
			case <-g.ctx.Done():
				return
			case value := <-g.buffer:
				g.processValue(value)
			}
		}
	}()
}

func (g *Group[T]) Stop() {
	if g.cancel != nil {
		g.cancel()
		g.wg.Wait()
	}
}

func (g *Group[T]) processValue(key T) {
	keyStr := g.opts.KeyFunc(key)
	g.debouncersMu.Lock()
	deb, ok := g.debouncers[keyStr]
	if !ok {
		deb = newDebouncer[T](g.opts.MinWait, g.opts.MaxWait, key, func(v T) {
			g.processWithMetrics(g.ctx, v, g.processHandler)

			g.debouncersMu.Lock()
			defer g.debouncersMu.Unlock()
			if current, exists := g.debouncers[keyStr]; exists && current == deb {
				delete(g.debouncers, keyStr)
			}
		})
		g.wg.Add(1)
		go func() {
			defer g.wg.Done()
			deb.run(g.ctx)
		}()
		g.debouncers[keyStr] = deb
	}
	g.debouncersMu.Unlock()

	deb.reset()
}

func (g *Group[T]) processWithMetrics(ctx context.Context, value T, processFunc ProcessFunc[T]) {
	timer := prometheus.NewTimer(g.metrics.processingDurationHistogram)
	defer timer.ObserveDuration()
	g.metrics.itemsProcessedCounter.Inc()

	if err := processFunc(ctx, value); err != nil {
		g.errorHandler(value, err)
		g.metrics.processingErrorsCounter.Inc()
	}
}

// debouncer handles debouncing for a specific key.
type debouncer[T any] struct {
	key         T
	resetChan   chan struct{}
	minWait     time.Duration
	maxWait     time.Duration
	processFunc func(T)
}

// newDebouncer creates a new key debouncer.
func newDebouncer[T any](minWait, maxWait time.Duration, key T, processFunc func(T)) *debouncer[T] {
	deb := &debouncer[T]{
		key:         key,
		resetChan:   make(chan struct{}, 1),
		minWait:     minWait,
		maxWait:     maxWait,
		processFunc: processFunc,
	}
	return deb
}

// reset triggers a timer reset for the minWait.
func (d *debouncer[T]) reset() {
	select {
	case d.resetChan <- struct{}{}:
		// Value sent successfully.
	default:
		// Value was dropped. Is not an issue as
		// a reset is already about to being processed.
	}
}

// run manages the debouncing process for a specific key.
func (d *debouncer[T]) run(ctx context.Context) {
	// Create timers after getting the first updateChan.
	minTimer := time.NewTimer(d.minWait)
	maxTimer := time.NewTimer(d.maxWait)
	defer func() {
		minTimer.Stop()
		maxTimer.Stop()
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case <-d.resetChan:
			if !minTimer.Stop() {
				select {
				case <-minTimer.C:
				default:
				}
			}
			minTimer.Reset(d.minWait)
		case <-minTimer.C:
			d.processFunc(d.key)
			return
		case <-maxTimer.C:
			d.processFunc(d.key)
			return
		}
	}
}
