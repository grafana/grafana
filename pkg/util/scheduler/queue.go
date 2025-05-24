package scheduler

import (
	"container/list"
	"context"
	"errors"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	// DefaultMaxSizePerTenant is the default maximum number of items per tenant in the queue.
	DefaultMaxSizePerTenant = 100
)

var ErrQueueClosed = errors.New("queue closed")
var ErrTenantQueueFull = errors.New("tenant queue full")

type tenantQueue struct {
	id       string
	items    []func()
	isActive bool
}

func (tq *tenantQueue) Len() int {
	return len(tq.items)
}
func (tq *tenantQueue) ID() string {
	return tq.id
}
func (tq *tenantQueue) Items() []func() {
	return tq.items
}
func (tq *tenantQueue) SetItems(items []func()) {
	tq.items = items
}
func (tq *tenantQueue) Clear() {
	tq.items = nil
	tq.isActive = false
}
func (tq *tenantQueue) IsEmpty() bool {
	return len(tq.items) == 0
}
func (tq *tenantQueue) IsFull(maxSize int) bool {
	return maxSize > 0 && len(tq.items) >= maxSize
}
func (tq *tenantQueue) AddRunnable(runnable func()) {
	tq.items = append(tq.items, runnable)
}
func (tq *tenantQueue) RemoveRunnable() {
	if len(tq.items) > 0 {
		tq.items = tq.items[1:]
	}
	if len(tq.items) == 0 {
		tq.isActive = false
	}
}
func (tq *tenantQueue) GetRunnable() func() {
	if len(tq.items) > 0 {
		return tq.items[0]
	}
	return nil
}
func (tq *tenantQueue) SetActive() {
	tq.isActive = true
}

type enqueueRequest struct {
	tenantID string
	runnable func()
	respChan chan error
}

type dequeueRequest struct {
	ctx      context.Context
	respChan chan dequeueResponse
}

type dequeueResponse struct {
	runnable func()
	ok       bool
	err      error
}

type lenRequest struct {
	respChan chan int
}

type activeTenantsLenRequest struct {
	respChan chan int
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
	MaxSizePerTenant  int
	QueueLength       *prometheus.GaugeVec   // per tenant
	DiscardedRequests *prometheus.CounterVec // per tenant
	EnqueueDuration   prometheus.Histogram
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

		// Metrics
		queueLength:       opts.QueueLength,
		discardedRequests: opts.DiscardedRequests,
		enqueueDuration:   opts.EnqueueDuration,
	}

	q.Service = services.NewBasicService(nil, q.dispatcherLoop, q.stopping)

	return q
}

func (q *Queue) shouldExit() bool {
	select {
	case <-q.dispatcherStoppedChan:
		return true
	default:
		return false
	}
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

		// Skip empty tenant queues by removing them and continuing
		if tq.IsEmpty() {
			tq.Clear()
			q.activeTenants.Remove(tenantElem)
			continue
		}

		// Get and deliver the runnable item
		item := tq.GetRunnable()
		req.respChan <- dequeueResponse{runnable: item, ok: true, err: nil}

		// Update bookkeeping
		q.pendingDequeueRequests.Remove(reqElem)
		tq.RemoveRunnable()
		q.queueLength.WithLabelValues(tq.id).Set(float64(len(tq.items)))

		// Round-robin: move to back if tenant still has items, otherwise remove
		if tq.IsEmpty() {
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
			items: make([]func(), 0, 8),
		}
		q.tenantQueues[req.tenantID] = tq
	}

	if tq.IsFull(q.maxSizePerTenant) {
		q.discardedRequests.WithLabelValues(req.tenantID, "queue_full").Inc()
		req.respChan <- ErrTenantQueueFull
		return
	}

	tq.AddRunnable(req.runnable)
	q.queueLength.WithLabelValues(req.tenantID).Set(float64(len(tq.items)))

	if !tq.isActive {
		q.activeTenants.PushBack(tq)
		tq.SetActive()
	}

	req.respChan <- nil
}

func (q *Queue) handleDequeueRequest(req dequeueRequest) {
	q.pendingDequeueRequests.PushBack(&req)
}

func (q *Queue) handleLenRequest(req lenRequest) {
	total := 0
	for _, tq := range q.tenantQueues {
		total += tq.Len()
	}
	req.respChan <- total
}

func (q *Queue) dispatcherLoop(ctx context.Context) error {
	defer close(q.dispatcherStoppedChan)

	for {
		if q.shouldExit() {
			return nil
		}

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
func (q *Queue) Enqueue(ctx context.Context, tenantID string, runnable func()) error {
	if runnable == nil {
		return errors.New("cannot enqueue nil runnable")
	}
	if tenantID == "" {
		return errors.New("item requires TenantID")
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
		q.discardedRequests.WithLabelValues(tenantID, "context_cancelled").Inc()
		err = ctx.Err()
	}

	return err
}

// Dequeue removes and returns a work item from the qos using linked-list round-robin.
// It blocks until an item is available for any tenant, the queue is closed,
// or the context is cancelled.
func (q *Queue) Dequeue(ctx context.Context) (func(), bool, error) {
	respChan := make(chan dequeueResponse, 1)
	req := dequeueRequest{
		ctx:      ctx,
		respChan: respChan,
	}

	select {
	case q.dequeueChan <- req:
		select {
		case resp := <-respChan:
			return resp.runnable, resp.ok, resp.err
		case <-ctx.Done():
			return nil, false, ctx.Err()
		case <-q.dispatcherStoppedChan:
			select {
			case resp := <-respChan:
				return resp.runnable, resp.ok, resp.err
			default:
				return nil, false, ErrQueueClosed
			}
		}
	case <-ctx.Done():
		return nil, false, ctx.Err()
	case <-q.dispatcherStoppedChan:
		return nil, false, ErrQueueClosed
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
		tq.Clear()
	}
	q.activeTenants.Init()
	q.pendingDequeueRequests.Init()
	return nil
}
