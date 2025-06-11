package scheduler

import (
	"container/list"
	"context"
	"errors"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	// DefaultMaxSizePerTenant is the default maximum number of items per tenant in the queue.
	DefaultMaxSizePerTenant = 100
)

var ErrQueueClosed = errors.New("queue closed")
var ErrTenantQueueFull = errors.New("tenant queue full")
var ErrNilRunnable = errors.New("cannot enqueue nil runnable")
var ErrMissingTenantID = errors.New("item requires TenantID")

type tenantQueue struct {
	id       string
	items    []func(ctx context.Context)
	isActive bool
}

func (tq *tenantQueue) len() int {
	return len(tq.items)
}
func (tq *tenantQueue) clear() {
	tq.items = nil
	tq.isActive = false
}
func (tq *tenantQueue) isEmpty() bool {
	return len(tq.items) == 0
}
func (tq *tenantQueue) isFull(maxSize int) bool {
	return maxSize > 0 && len(tq.items) >= maxSize
}
func (tq *tenantQueue) addItem(runnable func(ctx context.Context)) {
	tq.items = append(tq.items, runnable)
}

type enqueueRequest struct {
	tenantID string
	runnable func(ctx context.Context)
	respChan chan error
}

type dequeueRequest struct {
	respChan chan dequeueResponse
}

type dequeueResponse struct {
	runnable func(ctx context.Context)
	err      error
}

type lenRequest struct {
	respChan chan int
}

type activeTenantsLenRequest struct {
	respChan chan int
}

type NoopQueue struct{}

func (*NoopQueue) Enqueue(ctx context.Context, _ string, runnable func(ctx context.Context)) error {
	runnable(ctx)
	return nil
}

func NewNoopQueue() *NoopQueue {
	return &NoopQueue{}
}

// Queue implements a multi-tenant qos with round-robin fairness using a dispatcher goroutine.
type Queue struct {
	services.Service

	enqueueChan           chan enqueueRequest
	dequeueChan           chan dequeueRequest
	lenChan               chan lenRequest
	activeTenantsLenChan  chan activeTenantsLenRequest
	dispatcherStoppedChan chan struct{}

	// tenantQueues stores the queues for each tenant
	tenantQueues map[string]*tenantQueue
	// activeTenants is a list of tenants with items in their queues
	// used for round-robin dequeueing
	activeTenants *list.List
	// pendingDequeueRequests is a list of dequeue requests waiting for items
	// used for notifying when items are available
	pendingDequeueRequests *list.List
	// maxSizePerTenant is the maximum number of items per tenant
	maxSizePerTenant int

	// Metrics
	queueLength       *prometheus.GaugeVec
	discardedRequests *prometheus.CounterVec
	enqueueDuration   prometheus.Histogram
}

type QueueOptions struct {
	MaxSizePerTenant int
	Registerer       prometheus.Registerer
}

// NewQueue creates a new Queue and starts its dispatcher goroutine.
func NewQueue(opts *QueueOptions) *Queue {
	if opts.MaxSizePerTenant <= 0 {
		opts.MaxSizePerTenant = DefaultMaxSizePerTenant
	}

	q := &Queue{
		enqueueChan:           make(chan enqueueRequest),
		dequeueChan:           make(chan dequeueRequest),
		lenChan:               make(chan lenRequest),
		activeTenantsLenChan:  make(chan activeTenantsLenRequest),
		dispatcherStoppedChan: make(chan struct{}),

		tenantQueues:           make(map[string]*tenantQueue),
		activeTenants:          list.New(),
		pendingDequeueRequests: list.New(),
		maxSizePerTenant:       opts.MaxSizePerTenant,
	}

	q.queueLength = promauto.With(opts.Registerer).NewGaugeVec(prometheus.GaugeOpts{
		Name: "queue_length",
		Help: "Number of items in the queue",
	}, []string{"namespace"})
	q.discardedRequests = promauto.With(opts.Registerer).NewCounterVec(prometheus.CounterOpts{
		Name: "discarded_requests_total",
		Help: "Total number of discarded requests",
	}, []string{"namespace", "reason"})
	q.enqueueDuration = promauto.With(opts.Registerer).NewHistogram(prometheus.HistogramOpts{
		Name:    "enqueue_duration_seconds",
		Help:    "Duration of enqueue operation in seconds",
		Buckets: prometheus.DefBuckets,
	})

	q.Service = services.NewBasicService(nil, q.dispatcherLoop, q.stopping)

	return q
}

func (q *Queue) scheduleRoundRobin() {
	// Process as long as we have both pending requests and active tenants
	for {
		// Get the front elements of both lists
		reqElem := q.pendingDequeueRequests.Front()
		tenantElem := q.activeTenants.Front()

		// Exit when either list is empty
		if reqElem == nil || tenantElem == nil {
			break
		}

		req := reqElem.Value.(*dequeueRequest)
		tq := tenantElem.Value.(*tenantQueue)

		// Get and deliver the runnable item
		item := tq.items[0]
		req.respChan <- dequeueResponse{runnable: item, err: nil}

		// Update bookkeeping
		q.pendingDequeueRequests.Remove(reqElem)
		tq.items = tq.items[1:]

		// Update metrics
		q.queueLength.WithLabelValues(tq.id).Set(float64(tq.len()))

		// Round-robin: move to back if tenant still has items, otherwise remove
		if tq.isEmpty() {
			tq.clear()
			q.activeTenants.Remove(tenantElem)
		} else {
			q.activeTenants.MoveToBack(tenantElem)
		}
	}
}

func (q *Queue) handleEnqueueRequest(req enqueueRequest) {
	tq, exists := q.tenantQueues[req.tenantID]
	if !exists {
		tq = &tenantQueue{
			id:    req.tenantID,
			items: make([]func(ctx context.Context), 0, 8),
		}
		q.tenantQueues[req.tenantID] = tq
	}

	if tq.isFull(q.maxSizePerTenant) {
		q.discardedRequests.WithLabelValues(req.tenantID, "queue_full").Inc()
		req.respChan <- ErrTenantQueueFull
		return
	}

	tq.addItem(req.runnable)
	q.queueLength.WithLabelValues(req.tenantID).Set(float64(len(tq.items)))

	if !tq.isActive {
		q.activeTenants.PushBack(tq)
		tq.isActive = true
	}

	req.respChan <- nil
}

func (q *Queue) handleDequeueRequest(req dequeueRequest) {
	q.pendingDequeueRequests.PushBack(&req)
}

func (q *Queue) handleLenRequest(req lenRequest) {
	total := 0
	for _, tq := range q.tenantQueues {
		total += tq.len()
	}
	req.respChan <- total
}

func (q *Queue) dispatcherLoop(ctx context.Context) error {
	defer close(q.dispatcherStoppedChan)

	for {
		q.scheduleRoundRobin()

		select {
		case <-ctx.Done():
			return nil

		case req := <-q.enqueueChan:
			q.handleEnqueueRequest(req)

		case req := <-q.dequeueChan:
			q.handleDequeueRequest(req)

		case req := <-q.lenChan:
			q.handleLenRequest(req)

		case req := <-q.activeTenantsLenChan:
			req.respChan <- q.activeTenants.Len()
		}
	}
}

// Enqueue adds a work item to the appropriate tenant's qos.
// It blocks only if the dispatcher is busy or the tenant queue is full.
func (q *Queue) Enqueue(ctx context.Context, tenantID string, runnable func(ctx context.Context)) error {
	if runnable == nil {
		return ErrNilRunnable
	}
	if tenantID == "" {
		return ErrMissingTenantID
	}

	if q.State() != services.Running {
		return ErrQueueClosed
	}

	start := time.Now()

	respChan := make(chan error, 1)
	req := enqueueRequest{
		tenantID: tenantID,
		runnable: runnable,
		respChan: respChan,
	}

	var err error
	select {
	case q.enqueueChan <- req:
		err = <-respChan
		q.enqueueDuration.Observe(time.Since(start).Seconds())
	case <-q.dispatcherStoppedChan:
		q.discardedRequests.WithLabelValues(tenantID, "dispatcher_stopped").Inc()
		err = ErrQueueClosed
	case <-ctx.Done():
		q.discardedRequests.WithLabelValues(tenantID, "context_canceled").Inc()
		err = ctx.Err()
	}

	return err
}

// Dequeue removes and returns a work item from the qos using linked-list round-robin.
// It blocks until an item is available for any tenant, the queue is closed,
// or the context is cancelled.
func (q *Queue) Dequeue(ctx context.Context) (func(ctx context.Context), error) {
	if q.State() != services.Running {
		return nil, ErrQueueClosed
	}

	respChan := make(chan dequeueResponse, 1)
	req := dequeueRequest{
		respChan: respChan,
	}

	select {
	case q.dequeueChan <- req:
		select {
		case resp := <-respChan:
			return resp.runnable, resp.err
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-q.dispatcherStoppedChan:
		return nil, ErrQueueClosed
	}
}

// Len returns the total number of items across all tenants in the queue.
func (q *Queue) Len() int {
	respChan := make(chan int, 1)
	req := lenRequest{respChan: respChan}

	select {
	case q.lenChan <- req:
		select {
		case count := <-respChan:
			return count
		case <-q.dispatcherStoppedChan:
			return 0
		}
	case <-q.dispatcherStoppedChan:
		return 0
	}
}

// ActiveTenantsLen returns the number of tenants with items currently in the queue.
func (q *Queue) ActiveTenantsLen() int {
	respChan := make(chan int, 1)
	req := activeTenantsLenRequest{respChan: respChan}

	select {
	case q.activeTenantsLenChan <- req:
		select {
		case count := <-respChan:
			return count
		case <-q.dispatcherStoppedChan:
			return 0
		}
	case <-q.dispatcherStoppedChan:
		return 0
	}
}

func (q *Queue) stopping(_ error) error {
	q.queueLength.Reset()
	q.discardedRequests.Reset()
	for _, tq := range q.tenantQueues {
		tq.clear()
	}
	q.activeTenants.Init()
	q.pendingDequeueRequests.Init()
	return nil
}
