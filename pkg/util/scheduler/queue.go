package scheduler

import (
	"container/list"
	"context"
	"errors"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
)

var ErrQueueClosed = errors.New("queue closed")
var ErrTenantQueueFull = errors.New("tenant queue full")

type tenantQueue struct {
	id    string
	items []func()

	isStoredInActiveTenants *list.Element
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

type closeRequest struct {
	respChan chan struct{}
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
	closeChan             chan closeRequest
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
	// closed indicates if the queue is closed
	closed bool
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
		opts.MaxSizePerTenant = 100
	}

	q := &Queue{
		enqueueChan:           make(chan enqueueRequest),
		dequeueChan:           make(chan dequeueRequest),
		closeChan:             make(chan closeRequest),
		lenChan:               make(chan lenRequest),
		activeTenantsLenChan:  make(chan activeTenantsLenRequest),
		dispatcherStoppedChan: make(chan struct{}),

		tenantQueues:           make(map[string]*tenantQueue),
		activeTenants:          list.New(),
		pendingDequeueRequests: list.New(),
		closed:                 false,
		maxSizePerTenant:       opts.MaxSizePerTenant,

		// Metrics
		queueLength:       opts.QueueLength,
		discardedRequests: opts.DiscardedRequests,
		enqueueDuration:   opts.EnqueueDuration,
	}

	q.Service = services.NewBasicService(nil, q.dispatcherLoop, nil)

	return q
}

type firstDequeueItem struct {
	dequeueRespChan chan dequeueResponse
	runnable        func()
	tenantElem      *list.Element
}

func (q *Queue) shouldExit() bool {
	return q.closed && q.activeTenants.Len() == 0 && q.pendingDequeueRequests.Len() == 0
}

func (q *Queue) prepareDequeue() firstDequeueItem {
	item := firstDequeueItem{}

	pendingTenant := q.activeTenants.Front()
	if pendingTenant != nil && q.pendingDequeueRequests.Len() > 0 {
		tq := pendingTenant.Value.(*tenantQueue)
		if len(tq.items) > 0 {
			pendingReq := q.pendingDequeueRequests.Front()
			if pendingReq == nil {
				return item
			}

			item.runnable = tq.items[0]
			item.dequeueRespChan = pendingReq.Value.(*dequeueRequest).respChan
			item.tenantElem = pendingTenant
		} else {
			q.activeTenants.Remove(pendingTenant)
			tq.isStoredInActiveTenants = nil
		}
	}

	return item
}

func (q *Queue) handlePendingRequests() {
	for reqElem := q.pendingDequeueRequests.Front(); reqElem != nil && q.activeTenants.Len() > 0; {
		req := reqElem.Value.(*dequeueRequest)

		// If the request context is done, respond and remove it.
		if req.ctx.Err() != nil {
			req.respChan <- dequeueResponse{ok: false, err: req.ctx.Err()}
			next := reqElem.Next()
			q.pendingDequeueRequests.Remove(reqElem)
			reqElem = next
			continue
		}

		tenantElem := q.activeTenants.Front()
		if tenantElem == nil {
			break
		}

		tq := tenantElem.Value.(*tenantQueue)
		if len(tq.items) == 0 {
			q.activeTenants.Remove(tenantElem)
			tq.isStoredInActiveTenants = nil
			continue
		}

		// Respond to the request with the next runnable.
		item := tq.items[0]
		req.respChan <- dequeueResponse{runnable: item, ok: true, err: nil}
		q.pendingDequeueRequests.Remove(reqElem)
		tq.items = tq.items[1:]

		if len(tq.items) == 0 {
			q.activeTenants.Remove(tenantElem)
			tq.isStoredInActiveTenants = nil
		} else {
			q.activeTenants.MoveToBack(tenantElem)
		}

		reqElem = q.pendingDequeueRequests.Front()
	}
}

func (q *Queue) handleEnqueueRequest(req enqueueRequest) {
	if q.closed {
		q.discardedRequests.WithLabelValues(req.tenantID, "queue_closed").Inc()
		req.respChan <- ErrQueueClosed
		return
	}

	tq, exists := q.tenantQueues[req.tenantID]
	if !exists {
		tq = &tenantQueue{
			id:    req.tenantID,
			items: make([]func(), 0, 8),
		}
		q.tenantQueues[req.tenantID] = tq
	}

	if q.maxSizePerTenant > 0 && len(tq.items) >= q.maxSizePerTenant {
		q.discardedRequests.WithLabelValues(req.tenantID, "queue_full").Inc()
		req.respChan <- ErrTenantQueueFull
		return
	}

	tq.items = append(tq.items, req.runnable)
	q.queueLength.WithLabelValues(req.tenantID).Set(float64(len(tq.items)))

	if tq.isStoredInActiveTenants == nil {
		tq.isStoredInActiveTenants = q.activeTenants.PushBack(tq)
	}

	req.respChan <- nil
}

func (q *Queue) handleDequeueRequest(req dequeueRequest) {
	if req.ctx.Err() != nil {
		req.respChan <- dequeueResponse{ok: false, err: req.ctx.Err()}
		return
	}

	q.pendingDequeueRequests.PushBack(&req)
}

func (q *Queue) completeDequeue(tenantElem *list.Element) {
	reqElem := q.pendingDequeueRequests.Front()
	q.pendingDequeueRequests.Remove(reqElem)

	tq := tenantElem.Value.(*tenantQueue)
	tq.items = tq.items[1:]

	q.queueLength.WithLabelValues(tq.id).Set(float64(len(tq.items)))

	if len(tq.items) == 0 {
		q.activeTenants.Remove(tenantElem)
		tq.isStoredInActiveTenants = nil
		tq.items = nil
		delete(q.tenantQueues, tq.id)
	} else {
		q.activeTenants.MoveToBack(tenantElem)
	}
}

func (q *Queue) handleCloseRequest(req closeRequest) {
	if !q.closed {
		q.closed = true

		// Notify all pending requests that the queue is closed
		for e := q.pendingDequeueRequests.Front(); e != nil; e = e.Next() {
			dequeueReq := e.Value.(*dequeueRequest)
			dequeueReq.respChan <- dequeueResponse{ok: false, err: ErrQueueClosed}
		}
		q.pendingDequeueRequests.Init()

		// Reset queue length metrics for all tenants before clearing
		if q.queueLength != nil {
			for tenantID := range q.tenantQueues {
				q.queueLength.WithLabelValues(tenantID).Set(0)
			}
		}

		q.tenantQueues = make(map[string]*tenantQueue)
		q.activeTenants.Init()
	}

	req.respChan <- struct{}{}
}

func (q *Queue) handleLenRequest(req lenRequest) {
	total := 0
	for _, tq := range q.tenantQueues {
		total += len(tq.items)
	}
	req.respChan <- total
}

func (q *Queue) dispatcherLoop(ctx context.Context) error {
	defer close(q.dispatcherStoppedChan)

	for {
		if q.shouldExit() {
			return nil
		}

		first := q.prepareDequeue()

		select {
		case <-ctx.Done():
			return nil

		case req := <-q.enqueueChan:
			q.handleEnqueueRequest(req)

		case req := <-q.dequeueChan:
			q.handleDequeueRequest(req)

		case req := <-q.closeChan:
			q.handleCloseRequest(req)

		case req := <-q.lenChan:
			q.handleLenRequest(req)

		case req := <-q.activeTenantsLenChan:
			req.respChan <- q.activeTenants.Len()

		case first.dequeueRespChan <- dequeueResponse{runnable: first.runnable, ok: true, err: nil}:
			q.completeDequeue(first.tenantElem)
		}

		if !q.closed {
			q.handlePendingRequests()
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

	if ctx.Err() != nil {
		return ctx.Err()
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
	case <-q.dispatcherStoppedChan:
		q.discardedRequests.WithLabelValues(tenantID, "dispatcher_stopped").Inc()
		err = ErrQueueClosed
	case <-ctx.Done():
		q.discardedRequests.WithLabelValues(tenantID, "context_cancelled").Inc()
		err = ctx.Err()
	}

	q.enqueueDuration.Observe(time.Since(start).Seconds())

	return err
}

// Dequeue removes and returns a work item from the qos using linked-list round-robin.
// It blocks until an item is available for any tenant, the queue is closed,
// or the context is cancelled.
func (q *Queue) Dequeue(ctx context.Context) (func(), bool, error) {
	if ctx.Err() != nil {
		return nil, false, ctx.Err()
	}

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

// Len returns the total number of items across all tenants in the qos.
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

// ActiveTenantsLen returns the number of tenants with items currently in the qos.
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
