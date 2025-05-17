package qos

import (
	"container/list"
	"context"
	"errors"
	"time"
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
}

type QueueOptions struct {
	MaxSizePerTenant int
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
	}

	go q.dispatcherLoop()

	return q
}

func (q *Queue) dispatcherLoop() {
	tenantQueues := make(map[string]*tenantQueue)
	activeTenants := list.New()
	waitingDequeuers := list.New()
	closed := false

	defer close(q.dispatcherStoppedChan)

	for {
		if closed && activeTenants.Len() == 0 && waitingDequeuers.Len() == 0 {
			return
		}

		var firstDequeueReqChan chan dequeueResponse
		var firstRunnable func()
		elementToDequeue := activeTenants.Front()

		if !closed && elementToDequeue != nil && waitingDequeuers.Len() > 0 {
			selectedTenantQ := elementToDequeue.Value.(*tenantQueue)
			if len(selectedTenantQ.items) > 0 {
				firstRunnable = selectedTenantQ.items[0]
				firstDequeueReqChan = waitingDequeuers.Front().Value.(*dequeueRequest).respChan
			} else {
				activeTenants.Remove(elementToDequeue)
				selectedTenantQ.activeElement = nil
			}
		}

		select {
		case req := <-q.enqueueChan:
			if closed {
				req.respChan <- ErrQueueClosed
				continue
			}

			tq, exists := tenantQueues[req.tenantID]
			if !exists {
				tq = &tenantQueue{
					id:    req.tenantID,
					items: make([]func(), 0, 8),
				}
				tenantQueues[req.tenantID] = tq
			}

			if q.maxSizePerTenant > 0 && len(tq.items) >= q.maxSizePerTenant {
				req.respChan <- ErrTenantQueueFull
				continue
			}

			tq.items = append(tq.items, req.runnable)

			if tq.activeElement == nil {
				tq.activeElement = activeTenants.PushBack(tq)
			}

			req.respChan <- nil

		case req := <-q.dequeueChan:
			if closed {
				select {
				case req.respChan <- dequeueResponse{ok: false, err: ErrQueueClosed}:
				default:
				}
				continue
			}

			if req.ctx.Err() != nil {
				select {
				case req.respChan <- dequeueResponse{ok: false, err: req.ctx.Err()}:
				default:
				}
				continue
			}

			waitingDequeuers.PushBack(&req)

		case firstDequeueReqChan <- dequeueResponse{runnable: firstRunnable, ok: true, err: nil}:
			dequeuerElement := waitingDequeuers.Front()
			waitingDequeuers.Remove(dequeuerElement)

			selectedTenantQ := elementToDequeue.Value.(*tenantQueue)
			selectedTenantQ.items = selectedTenantQ.items[1:]

			if len(selectedTenantQ.items) == 0 {
				activeTenants.Remove(elementToDequeue)
				selectedTenantQ.activeElement = nil
			} else {
				activeTenants.MoveToBack(elementToDequeue)
			}

		case req := <-q.closeChan:
			if !closed {
				closed = true
				for e := waitingDequeuers.Front(); e != nil; e = e.Next() {
					waiterReq := e.Value.(*dequeueRequest)
					select {
					case waiterReq.respChan <- dequeueResponse{ok: false, err: ErrQueueClosed}:
					default:
					}
				}
				waitingDequeuers.Init()

				tenantQueues = make(map[string]*tenantQueue)
				activeTenants.Init()
			}

			select {
			case req.respChan <- struct{}{}:
			default:
			}

			if closed && activeTenants.Len() == 0 && waitingDequeuers.Len() == 0 {
				return
			}

		case req := <-q.lenChan:
			total := 0
			for _, tq := range tenantQueues {
				total += len(tq.items)
			}
			req.respChan <- total

		case req := <-q.activeTenantsLenChan:
			req.respChan <- activeTenants.Len()
		}

		if !closed {
			currentWorkerElem := waitingDequeuers.Front()
			for currentWorkerElem != nil && activeTenants.Len() > 0 {
				nextWorkerElem := currentWorkerElem.Next()
				workerReq := currentWorkerElem.Value.(*dequeueRequest)

				if workerReq.ctx.Err() != nil {
					workerReq.respChan <- dequeueResponse{ok: false, err: workerReq.ctx.Err()}
					waitingDequeuers.Remove(currentWorkerElem)
					currentWorkerElem = nextWorkerElem
					continue
				}

				currentTenantElem := activeTenants.Front()
				if currentTenantElem == nil {
					break
				}
				selectedTenantQ := currentTenantElem.Value.(*tenantQueue)

				if len(selectedTenantQ.items) == 0 {
					activeTenants.Remove(currentTenantElem)
					selectedTenantQ.activeElement = nil
					break
				}

				itemToSend := selectedTenantQ.items[0]

				workerReq.respChan <- dequeueResponse{runnable: itemToSend, ok: true, err: nil}

				waitingDequeuers.Remove(currentWorkerElem)
				selectedTenantQ.items = selectedTenantQ.items[1:]

				if len(selectedTenantQ.items) == 0 {
					activeTenants.Remove(currentTenantElem)
					selectedTenantQ.activeElement = nil
				} else {
					activeTenants.MoveToBack(currentTenantElem)
				}

				currentWorkerElem = nextWorkerElem
			}
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

	respChan := make(chan error, 1)
	req := enqueueRequest{
		tenantID: tenantID,
		runnable: runnable,
		respChan: respChan,
	}

	select {
	case q.enqueueChan <- req:
		err := <-respChan
		return err
	case <-q.dispatcherStoppedChan:
		return ErrQueueClosed
	case <-ctx.Done():
		return ctx.Err()
	}
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
