package util

import (
	"context"
	"sync"
	"time"
)

// KeyFunc is a function that extracts a string key from a value
type KeyFunc[T any] func(T) string

// ProcessFunc is a function that processes a value
type ProcessFunc[T any] func(ctx context.Context, value T) error

// Debouncer provides debouncing functionality for values with the same key
type Debouncer[T any] struct {
	buffer      chan T
	keyFunc     KeyFunc[T]
	processFunc ProcessFunc[T]
	minWait     time.Duration
	maxWait     time.Duration
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

// NewDebouncer creates a new debouncer with the given buffer size
func NewDebouncer[T any](
	bufferSize int,
	keyFunc KeyFunc[T],
	minWait time.Duration,
	maxWait time.Duration,
) *Debouncer[T] {
	return &Debouncer[T]{
		buffer:  make(chan T, bufferSize),
		keyFunc: keyFunc,
		minWait: minWait,
		maxWait: maxWait,
	}
}

// Add adds a value to the debouncer
// Returns true if the value was added, false if the buffer is full
func (d *Debouncer[T]) Add(value T) bool {
	select {
	case d.buffer <- value:
		return true
	default:
		return false
	}
}

// Start starts the debouncer with the given process function
func (d *Debouncer[T]) Start(ctx context.Context, processFunc ProcessFunc[T]) {
	d.ctx, d.cancel = context.WithCancel(ctx)
	d.processFunc = processFunc

	d.wg.Add(1)
	go d.worker()
}

// Stop stops the debouncer
func (d *Debouncer[T]) Stop() {
	if d.cancel != nil {
		d.cancel()
		d.wg.Wait()
	}
}

// SetMinWait sets the minimum wait time between processing the same key
func (d *Debouncer[T]) SetMinWait(minWait time.Duration) {
	d.minWait = minWait
}

// SetMaxWait sets the maximum wait time before forcing processing
func (d *Debouncer[T]) SetMaxWait(maxWait time.Duration) {
	d.maxWait = maxWait
}

// worker is the background goroutine that processes values
func (d *Debouncer[T]) worker() {
	defer d.wg.Done()

	// Create a map to track debounced keys
	debouncers := make(map[string]*keyDebouncer[T])

	// Cleanup ticker to remove completed debouncers
	cleanupTicker := time.NewTicker(time.Minute)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			// Cancel all active debouncers
			for _, kd := range debouncers {
				kd.cancel()
			}
			return

		case value := <-d.buffer:
			keyStr := d.keyFunc(value)

			// Get or create a debouncer for this key
			debouncer, exists := debouncers[keyStr]
			if !exists || debouncer.isDone() {
				// Create a new debouncer for this key
				debouncer = newKeyDebouncer(d.ctx, value, d.minWait, d.maxWait, d.processFunc)
				debouncers[keyStr] = debouncer
			} else {
				// Update the existing debouncer with the new value
				debouncer.update(value)
			}

		case <-cleanupTicker.C:
			// Remove completed debouncers
			for keyStr, debouncer := range debouncers {
				if debouncer.isDone() {
					delete(debouncers, keyStr)
				}
			}
		}
	}
}

// keyDebouncer handles debouncing for a specific key
type keyDebouncer[T any] struct {
	value       T
	minTimer    *time.Timer
	maxTimer    *time.Timer
	processFunc ProcessFunc[T]
	ctx         context.Context
	cancel      context.CancelFunc
	mu          sync.Mutex
	done        bool
}

// newKeyDebouncer creates a new debouncer for a specific key
func newKeyDebouncer[T any](
	parentCtx context.Context,
	value T,
	minWait time.Duration,
	maxWait time.Duration,
	processFunc ProcessFunc[T],
) *keyDebouncer[T] {
	ctx, cancel := context.WithCancel(parentCtx)

	d := &keyDebouncer[T]{
		value:       value,
		processFunc: processFunc,
		ctx:         ctx,
		cancel:      cancel,
	}

	// Start the timers
	d.minTimer = time.AfterFunc(minWait, d.process)
	d.maxTimer = time.AfterFunc(maxWait, d.process)

	return d
}

// update updates the value to be processed
func (d *keyDebouncer[T]) update(value T) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.done {
		return
	}

	// Update the value
	d.value = value

	// Reset the min timer
	if !d.minTimer.Stop() {
		// Timer already fired or was stopped
		select {
		case <-d.minTimer.C:
		default:
		}
	}
	d.minTimer.Reset(time.Minute)
}

// process processes the value
func (d *keyDebouncer[T]) process() {
	d.mu.Lock()

	if d.done {
		d.mu.Unlock()
		return
	}

	// Mark as done and stop timers
	d.done = true

	// Stop the timers
	if d.minTimer != nil {
		d.minTimer.Stop()
	}
	if d.maxTimer != nil {
		d.maxTimer.Stop()
	}

	// Get the value to process
	value := d.value
	d.mu.Unlock()

	// Process the value
	if d.processFunc != nil {
		_ = d.processFunc(d.ctx, value)
	}
}

// isDone returns true if the debouncer is done
func (d *keyDebouncer[T]) isDone() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.done
}
