package scheduler

import (
	"container/list"
	"context"
	"errors"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	// DefaultMaxSizePerTenant is the default maximum number of items per tenant in the queue.
	DefaultMaxSizePerTenant = 100
)

var ErrQueueClosed = errors.New("queue closed")
var ErrTenantQueueFull = errors.New("tenant queue full")
var ErrNilRunnable = errors.New("cannot enqueue nil runnable")
var ErrMissingTenantID = errors.New("item requires TenantID")

// queuedItem represents a runnable task annotated with its enqueue timestamp.
// The timestamp allows us to compute how long the task spent waiting in the queue
// before being picked up by a worker.
type queuedItem struct {
	runnable   func()
	enqueuedAt time.Time
	ctx        context.Context
	stopCancel func() bool
	tenant     *tenantQueue
	queuedElem *list.Element
}

type tenantQueue struct {
	id         string
	items      list.List
	inFlight   int
	activeElem *list.Element
}

func (tq *tenantQueue) len() int {
	return tq.items.Len()
}
func (tq *tenantQueue) clear() {
	tq.items.Init()
	tq.activeElem = nil
}
func (tq *tenantQueue) isEmpty() bool {
	return tq.items.Len() == 0
}
func (tq *tenantQueue) isFull(maxSize int) bool {
	return maxSize > 0 && tq.items.Len() >= maxSize
}

type enqueueRequest struct {
	tenantID string
	item     *queuedItem
	respChan chan error
}

type dequeueRequest struct {
	ctx         context.Context
	respChan    chan dequeueResponse
	pendingElem *list.Element
}

type dequeueResponse struct {
	runnable func()
	err      error
}

type lenRequest struct {
	respChan chan int
}

type activeTenantsLenRequest struct {
	respChan chan int
}

type NoopQueue struct{}

func (*NoopQueue) Enqueue(ctx context.Context, _ string, runnable func()) error {
	runnable()
	return nil
}

func NewNoopQueue() *NoopQueue {
	return &NoopQueue{}
}

// Queue implements a multi-tenant qos with round-robin fairness using a dispatcher goroutine.
type Queue struct {
	services.Service

	logger log.Logger

	enqueueChan           chan enqueueRequest
	dequeueChan           chan *dequeueRequest
	lenChan               chan lenRequest
	activeTenantsLenChan  chan activeTenantsLenRequest
	dispatcherStoppedChan chan struct{}
	completionChan        chan *tenantQueue
	cancelItemChan        chan *queuedItem
	cancelDequeueChan     chan *dequeueRequest

	// tenantQueues stores the queues for each tenant
	tenantQueues map[string]*tenantQueue
	// activeTenants is a list of tenants with items in their queues
	// used for round-robin dequeueing
	activeTenants *list.List
	// pendingDequeueRequests is a list of dequeue requests waiting for items
	// used for notifying when items are available
	pendingDequeueRequests *list.List
	// maxSizePerTenant is the maximum number of items per tenant
	maxSizePerTenant       int
	maxConcurrentPerTenant int

	// Metrics
	inFlight          prometheus.Gauge
	queueLength       *prometheus.GaugeVec
	discardedRequests *prometheus.CounterVec
	queueWaitDuration *prometheus.HistogramVec
}

type QueueOptions struct {
	MaxSizePerTenant       int
	MaxConcurrentPerTenant int
	Registerer             prometheus.Registerer
	Logger                 log.Logger
}

// NewQueue creates a new Queue and starts its dispatcher goroutine.
func NewQueue(opts *QueueOptions) *Queue {
	if opts.MaxSizePerTenant <= 0 {
		opts.MaxSizePerTenant = DefaultMaxSizePerTenant
	}
	if opts.Logger == nil {
		opts.Logger = log.NewNopLogger()
	}

	q := &Queue{
		logger: opts.Logger,

		enqueueChan:           make(chan enqueueRequest),
		dequeueChan:           make(chan *dequeueRequest),
		lenChan:               make(chan lenRequest),
		activeTenantsLenChan:  make(chan activeTenantsLenRequest),
		dispatcherStoppedChan: make(chan struct{}),
		completionChan:        make(chan *tenantQueue),
		cancelItemChan:        make(chan *queuedItem),
		cancelDequeueChan:     make(chan *dequeueRequest),

		tenantQueues:           make(map[string]*tenantQueue),
		activeTenants:          list.New(),
		pendingDequeueRequests: list.New(),
		maxSizePerTenant:       opts.MaxSizePerTenant,
		maxConcurrentPerTenant: max(0, opts.MaxConcurrentPerTenant),
	}

	q.inFlight = promauto.With(opts.Registerer).NewGauge(prometheus.GaugeOpts{
		Name: "grafana_resource_server_qos_in_flight",
		Help: "Number of reserved or executing requests across all tenants",
	})
	q.queueLength = promauto.With(opts.Registerer).NewGaugeVec(prometheus.GaugeOpts{
		Name: "grafana_resource_server_qos_queue_length",
		Help: "Number of items in the queue",
	}, []string{"tenant"})
	q.discardedRequests = promauto.With(opts.Registerer).NewCounterVec(prometheus.CounterOpts{
		Name: "grafana_resource_server_qos_discarded_requests_total",
		Help: "Total number of discarded requests",
	}, []string{"tenant", "reason"})
	q.queueWaitDuration = promauto.With(opts.Registerer).NewHistogramVec(prometheus.HistogramOpts{
		Name:                            "grafana_resource_server_qos_queue_wait_duration_seconds",
		Help:                            "Time items spend waiting in the queue before execution begins, in seconds",
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  160,
		NativeHistogramMinResetDuration: time.Hour,
	}, []string{"tenant"})

	q.Service = services.NewBasicService(nil, q.dispatcherLoop, q.stopping)

	return q
}

func (q *Queue) scheduleRoundRobin() {
	for q.pendingDequeueRequests.Len() > 0 {
		reqElem := q.pendingDequeueRequests.Front()
		req := reqElem.Value.(*dequeueRequest)
		if req.ctx.Err() != nil {
			q.cancelDequeue(req)
			continue
		}
		var tenantElem *list.Element
		for elem := q.activeTenants.Front(); elem != nil; elem = elem.Next() {
			tq := elem.Value.(*tenantQueue)
			if q.maxConcurrentPerTenant == 0 || tq.inFlight < q.maxConcurrentPerTenant {
				tenantElem = elem
				break
			}
		}
		if tenantElem == nil {
			break
		}
		tq := tenantElem.Value.(*tenantQueue)
		qi := tq.items.Remove(tq.items.Front()).(*queuedItem)
		qi.queuedElem = nil
		qi.stopCancel()
		tq.inFlight++
		q.inFlight.Inc()
		q.queueLength.WithLabelValues(tq.id).Set(float64(tq.len()))
		q.pendingDequeueRequests.Remove(reqElem)
		req.pendingElem = nil
		req.respChan <- dequeueResponse{runnable: q.wrapRunnable(qi)}
		q.cleanupTenant(tq)
		if tq.activeElem != nil {
			q.activeTenants.MoveToBack(tq.activeElem)
		}
	}
}

func (q *Queue) wrapRunnable(qi *queuedItem) func() {
	return func() {
		tq := qi.tenant
		defer func() {
			select {
			case q.completionChan <- tq:
			case <-q.dispatcherStoppedChan:
			}
		}()
		if err := qi.ctx.Err(); err != nil {
			q.recordCancellation(tq.id, err)
			return
		}
		q.queueWaitDuration.WithLabelValues(tq.id).Observe(time.Since(qi.enqueuedAt).Seconds())
		qi.runnable()
	}
}

func (q *Queue) cleanupTenant(tq *tenantQueue) {
	if !tq.isEmpty() {
		return
	}
	if tq.activeElem != nil {
		q.activeTenants.Remove(tq.activeElem)
	}
	tq.clear()
	if tq.inFlight == 0 && q.tenantQueues[tq.id] == tq {
		delete(q.tenantQueues, tq.id)
	}
}

func (q *Queue) cancelItem(qi *queuedItem) {
	if qi.queuedElem == nil {
		return
	}
	tq := qi.tenant
	qi.stopCancel()
	tq.items.Remove(qi.queuedElem)
	qi.queuedElem = nil
	q.recordCancellation(tq.id, qi.ctx.Err())
	q.queueLength.WithLabelValues(tq.id).Set(float64(tq.len()))
	q.cleanupTenant(tq)
}

func (q *Queue) recordCancellation(tenantID string, err error) {
	reason := "context_canceled"
	if errors.Is(err, context.DeadlineExceeded) {
		reason = "deadline_exceeded"
	}
	q.discardedRequests.WithLabelValues(tenantID, reason).Inc()
}

func (q *Queue) handleEnqueueRequest(req enqueueRequest) {
	qi := req.item
	if err := qi.ctx.Err(); err != nil {
		q.recordCancellation(req.tenantID, err)
		req.respChan <- err
		return
	}
	tq, exists := q.tenantQueues[req.tenantID]
	if !exists {
		tq = &tenantQueue{id: req.tenantID}
		q.tenantQueues[req.tenantID] = tq
	}

	if tq.isFull(q.maxSizePerTenant) {
		q.discardedRequests.WithLabelValues(req.tenantID, "queue_full").Inc()
		req.respChan <- ErrTenantQueueFull
		return
	}

	qi.enqueuedAt = time.Now()
	qi.tenant = tq
	qi.stopCancel = context.AfterFunc(qi.ctx, func() {
		select {
		case q.cancelItemChan <- qi:
		case <-q.dispatcherStoppedChan:
		}
	})
	qi.queuedElem = tq.items.PushBack(qi)
	q.queueLength.WithLabelValues(req.tenantID).Set(float64(tq.len()))

	if tq.activeElem == nil {
		tq.activeElem = q.activeTenants.PushBack(tq)
	}

	req.respChan <- nil
}

func (q *Queue) handleDequeueRequest(req *dequeueRequest) {
	req.pendingElem = q.pendingDequeueRequests.PushBack(req)
}

func (q *Queue) cancelDequeue(req *dequeueRequest) {
	if req.pendingElem == nil {
		return
	}
	q.pendingDequeueRequests.Remove(req.pendingElem)
	req.pendingElem = nil
	req.respChan <- dequeueResponse{err: req.ctx.Err()}
}

func (q *Queue) handleLenRequest(req lenRequest) {
	total := 0
	for _, tq := range q.tenantQueues {
		total += tq.len()
	}
	req.respChan <- total
}

func (q *Queue) dispatcherLoop(ctx context.Context) error {
	defer func() {
		for elem := q.pendingDequeueRequests.Front(); elem != nil; elem = elem.Next() {
			elem.Value.(*dequeueRequest).respChan <- dequeueResponse{err: ErrQueueClosed}
		}
		close(q.dispatcherStoppedChan)
	}()

	q.logger.Info("queue running", "maxSizePerTenant", q.maxSizePerTenant)

	for {
		q.scheduleRoundRobin()

		select {
		case <-ctx.Done():
			return nil

		case req := <-q.enqueueChan:
			q.handleEnqueueRequest(req)

		case req := <-q.dequeueChan:
			q.handleDequeueRequest(req)

		case tq := <-q.completionChan:
			tq.inFlight--
			q.inFlight.Dec()
			q.cleanupTenant(tq)
		case qi := <-q.cancelItemChan:
			q.cancelItem(qi)
		case req := <-q.cancelDequeueChan:
			q.cancelDequeue(req)
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
		return ErrNilRunnable
	}
	if tenantID == "" {
		return ErrMissingTenantID
	}

	if q.State() != services.Running {
		return ErrQueueClosed
	}

	respChan := make(chan error, 1)
	req := enqueueRequest{
		tenantID: tenantID,
		item:     &queuedItem{ctx: ctx, runnable: runnable},
		respChan: respChan,
	}

	select {
	case q.enqueueChan <- req:
		return <-respChan
	case <-q.dispatcherStoppedChan:
		q.discardedRequests.WithLabelValues(tenantID, "dispatcher_stopped").Inc()
		return ErrQueueClosed
	case <-ctx.Done():
		err := ctx.Err()
		q.recordCancellation(tenantID, err)
		return err
	}
}

// Dequeue removes and returns a work item from the qos using linked-list round-robin.
// It blocks until an item is available for any tenant, the queue is closed,
// or the context is cancelled.
// The caller must invoke a successfully returned runnable exactly once to release
// its execution slot.
func (q *Queue) Dequeue(ctx context.Context) (func(), error) {
	if q.State() != services.Running {
		return nil, ErrQueueClosed
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	req := &dequeueRequest{ctx: ctx, respChan: make(chan dequeueResponse, 1)}
	select {
	case q.dequeueChan <- req:
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-q.dispatcherStoppedChan:
		return nil, ErrQueueClosed
	}
	stop := context.AfterFunc(ctx, func() {
		select {
		case q.cancelDequeueChan <- req:
		case <-q.dispatcherStoppedChan:
		}
	})
	defer stop()
	// Once accepted, the dispatcher owns cancellation and delivery. Returning on
	// ctx.Done here could abandon a runnable whose execution slot was reserved.
	resp := <-req.respChan
	return resp.runnable, resp.err
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
	q.logger.Info("queue stopping")

	q.queueLength.Reset()
	q.discardedRequests.Reset()
	q.inFlight.Set(0)
	for _, tq := range q.tenantQueues {
		for elem := tq.items.Front(); elem != nil; elem = elem.Next() {
			qi := elem.Value.(*queuedItem)
			qi.stopCancel()
			qi.queuedElem = nil
		}
		tq.clear()
	}
	clear(q.tenantQueues)
	q.activeTenants.Init()
	q.pendingDequeueRequests.Init()

	q.logger.Info("queue stopped")
	return nil
}
