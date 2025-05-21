package scheduler

import (
	"container/list"
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var ErrQueueClosed = errors.New("queue closed")
var ErrTenantQueueFull = errors.New("tenant queue full")

type tenantQueue struct {
	id    string
	items []func()

	activeElement *list.Element
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
	enqueueChan           chan enqueueRequest
	dequeueChan           chan dequeueRequest
	closeChan             chan closeRequest
	lenChan               chan lenRequest
	activeTenantsLenChan  chan activeTenantsLenRequest
	dispatcherStoppedChan chan struct{}

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
		maxSizePerTenant:      opts.MaxSizePerTenant,

		// Metrics
		queueLength:       opts.QueueLength,
		discardedRequests: opts.DiscardedRequests,
		enqueueDuration:   opts.EnqueueDuration,
	}

	go q.dispatcherLoop()

	return q
}

type dispatcherState struct {
	tenantQueues     map[string]*tenantQueue
	activeTenants    *list.List
	pendingRequests  *list.List
	closed           bool
	maxSizePerTenant int

	// Metrics
	queueLength       *prometheus.GaugeVec
	discardedRequests *prometheus.CounterVec
}

type firstDequeueItem struct {
	dequeueReqChan chan dequeueResponse
	runnable       func()
	tenantElem     *list.Element
}

func (s *dispatcherState) shouldExit() bool {
	return s.closed && s.activeTenants.Len() == 0 && s.pendingRequests.Len() == 0
}

func (s *dispatcherState) prepareFirstDequeue() firstDequeueItem {
	item := firstDequeueItem{}

	pendingTenant := s.activeTenants.Front()
	if !s.closed && pendingTenant != nil && s.pendingRequests.Len() > 0 {
		tq := pendingTenant.Value.(*tenantQueue)
		if len(tq.items) > 0 {
			item.runnable = tq.items[0]
			item.dequeueReqChan = s.pendingRequests.Front().Value.(*dequeueRequest).respChan
			item.tenantElem = pendingTenant
		} else {
			s.activeTenants.Remove(pendingTenant)
			tq.activeElement = nil
		}
	}

	return item
}

func (s *dispatcherState) handleEnqueueRequest(req enqueueRequest) {
	if s.closed {
		s.discardedRequests.WithLabelValues(req.tenantID, "queue_closed").Inc()
		req.respChan <- ErrQueueClosed
		return
	}

	s.processEnqueue(req)
}

func (s *dispatcherState) processEnqueue(req enqueueRequest) {
	tq, exists := s.tenantQueues[req.tenantID]
	if !exists {
		tq = &tenantQueue{
			id:    req.tenantID,
			items: make([]func(), 0, 8),
		}
		s.tenantQueues[req.tenantID] = tq
	}

	if s.maxSizePerTenant > 0 && len(tq.items) >= s.maxSizePerTenant {
		s.discardedRequests.WithLabelValues(req.tenantID, "queue_full").Inc()
		req.respChan <- ErrTenantQueueFull
		return
	}

	tq.items = append(tq.items, req.runnable)
	s.queueLength.WithLabelValues(req.tenantID).Set(float64(len(tq.items)))

	if tq.activeElement == nil {
		tq.activeElement = s.activeTenants.PushBack(tq)
	}

	req.respChan <- nil
}

func (s *dispatcherState) handleDequeueRequest(req dequeueRequest) {
	if s.closed {
		s.dispatchDequeueResponse(req, dequeueResponse{ok: false, err: ErrQueueClosed})
		return
	}

	if req.ctx.Err() != nil {
		s.dispatchDequeueResponse(req, dequeueResponse{ok: false, err: req.ctx.Err()})
		return
	}

	s.pendingRequests.PushBack(&req)
}

func (s *dispatcherState) completeDequeue(tenantElem *list.Element) {
	reqElem := s.pendingRequests.Front()
	s.pendingRequests.Remove(reqElem)

	tq := tenantElem.Value.(*tenantQueue)
	tq.items = tq.items[1:]

	s.queueLength.WithLabelValues(tq.id).Set(float64(len(tq.items)))

	if len(tq.items) == 0 {
		s.activeTenants.Remove(tenantElem)
		tq.activeElement = nil
	} else {
		s.activeTenants.MoveToBack(tenantElem)
	}
}

func (s *dispatcherState) handleCloseRequest(req closeRequest) {
	if !s.closed {
		s.closed = true
		s.notifyPendingRequests()
		s.clearQueues()
	}

	select {
	case req.respChan <- struct{}{}:
	default:
	}
}

func (s *dispatcherState) notifyPendingRequests() {
	for e := s.pendingRequests.Front(); e != nil; e = e.Next() {
		waiterReq := e.Value.(*dequeueRequest)
		s.dispatchDequeueResponse(*waiterReq, dequeueResponse{ok: false, err: ErrQueueClosed})
	}
	s.pendingRequests.Init()
}

func (s *dispatcherState) clearQueues() {
	// Reset queue length metrics for all tenants before clearing
	if s.queueLength != nil {
		for tenantID := range s.tenantQueues {
			s.queueLength.WithLabelValues(tenantID).Set(0)
		}
	}

	s.tenantQueues = make(map[string]*tenantQueue)
	s.activeTenants.Init()
}

func (s *dispatcherState) handleLenRequest(req lenRequest) {
	total := 0
	for _, tq := range s.tenantQueues {
		total += len(tq.items)
	}
	req.respChan <- total
}

func (s *dispatcherState) handlePendingRequests() {
	reqElem := s.pendingRequests.Front()
	for reqElem != nil && s.activeTenants.Len() > 0 {
		nextRequestElement := reqElem.Next()

		if s.shouldStopProcessingRequests(reqElem) {
			break
		}

		reqElem = nextRequestElement
	}
}

func (s *dispatcherState) shouldStopProcessingRequests(reqElem *list.Element) bool {
	req := reqElem.Value.(*dequeueRequest)

	if req.ctx.Err() != nil {
		s.dispatchDequeueResponse(*req, dequeueResponse{ok: false, err: req.ctx.Err()})
		s.pendingRequests.Remove(reqElem)
		return false
	}

	tenantElem := s.activeTenants.Front()
	if tenantElem == nil {
		return true
	}

	tq := tenantElem.Value.(*tenantQueue)
	if len(tq.items) == 0 {
		s.activeTenants.Remove(tenantElem)
		tq.activeElement = nil
		return true
	}

	s.sendDequeueResponse(req, reqElem, tenantElem, tq)
	return false
}

func (s *dispatcherState) sendDequeueResponse(
	req *dequeueRequest,
	reqElem *list.Element,
	tenantElem *list.Element,
	tenantQ *tenantQueue,
) {
	item := tenantQ.items[0]
	req.respChan <- dequeueResponse{runnable: item, ok: true, err: nil}

	s.pendingRequests.Remove(reqElem)
	tenantQ.items = tenantQ.items[1:]

	if len(tenantQ.items) == 0 {
		s.activeTenants.Remove(tenantElem)
		tenantQ.activeElement = nil
	} else {
		s.activeTenants.MoveToBack(tenantElem)
	}
}

func (s *dispatcherState) dispatchDequeueResponse(req dequeueRequest, resp dequeueResponse) {
	select {
	case req.respChan <- resp:
	default:
	}
}

func (q *Queue) dispatcherLoop() {
	state := &dispatcherState{
		tenantQueues:     make(map[string]*tenantQueue),
		activeTenants:    list.New(),
		pendingRequests:  list.New(),
		closed:           false,
		maxSizePerTenant: q.maxSizePerTenant,

		// Metrics
		queueLength:       q.queueLength,
		discardedRequests: q.discardedRequests,
	}

	defer close(q.dispatcherStoppedChan)

	for {
		if state.shouldExit() {
			return
		}

		first := state.prepareFirstDequeue()

		select {
		case req := <-q.enqueueChan:
			state.handleEnqueueRequest(req)

		case req := <-q.dequeueChan:
			state.handleDequeueRequest(req)

		case req := <-q.closeChan:
			state.handleCloseRequest(req)

		case req := <-q.lenChan:
			state.handleLenRequest(req)

		case req := <-q.activeTenantsLenChan:
			req.respChan <- state.activeTenants.Len()

		case first.dequeueReqChan <- dequeueResponse{runnable: first.runnable, ok: true, err: nil}:
			state.completeDequeue(first.tenantElem)
		}

		if !state.closed {
			state.handlePendingRequests()
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

// Close marks the queue as closed and signals the dispatcher.
// It blocks until the dispatcher acknowledges the close.
func (q *Queue) Close() {
	respChan := make(chan struct{})
	req := closeRequest{respChan: respChan}

	select {
	case q.closeChan <- req:
		select {
		case <-respChan:
		case <-q.dispatcherStoppedChan:
		case <-time.After(500 * time.Millisecond):
		}
	case <-q.dispatcherStoppedChan:
	case <-time.After(500 * time.Millisecond):
		select {
		case <-q.dispatcherStoppedChan:
		default:
			close(q.dispatcherStoppedChan)
		}
	}
}

// StopWait blocks until the dispatcher goroutine has fully stopped.
// Call Close() first to initiate shutdown.
func (q *Queue) StopWait() {
	select {
	case <-q.dispatcherStoppedChan:
		return
	case <-time.After(2 * time.Second):
		return
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
