package router

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// destroyer is implemented by handlers that hold resources, such as a
// plugin's API server, which must be released once the handler is retired.
type destroyer interface {
	Destroy()
}

// retiredDrainWarning is how long a retired handler may keep serving requests
// before the router logs that its teardown is waiting on them.
const retiredDrainWarning = time.Minute

// handlerUse counts the requests in flight on a handler that must be
// destroyed after it is retired, so it is destroyed only once the last of
// them finishes. A nil handlerUse tracks nothing.
type handlerUse struct {
	mu       sync.Mutex
	inFlight int
	retired  bool
	drained  chan struct{}
}

func newHandlerUse(handler http.Handler) *handlerUse {
	if _, ok := handler.(destroyer); !ok {
		return nil
	}
	return &handlerUse{drained: make(chan struct{})}
}

// enter records a request starting. It fails once the handler is retired: the
// caller looked it up in a snapshot that has since been replaced.
func (u *handlerUse) enter() bool {
	if u == nil {
		return true
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.retired {
		return false
	}
	u.inFlight++
	return true
}

func (u *handlerUse) exit() {
	if u == nil {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	u.inFlight--
	if u.retired && u.inFlight == 0 {
		close(u.drained)
	}
}

// retire refuses new requests and returns a channel closed once the requests
// already in flight finish.
func (u *handlerUse) retire() <-chan struct{} {
	u.mu.Lock()
	defer u.mu.Unlock()
	if !u.retired {
		u.retired = true
		if u.inFlight == 0 {
			close(u.drained)
		}
	}
	return u.drained
}

// destroyWhenDrained destroys a retired entry's handler once its in-flight
// requests finish. It never destroys a handler under a running request, so a
// request that never ends keeps its handler alive; that is logged.
func destroyWhenDrained(ctx context.Context, group string, e *handlerEntry) {
	if e.use == nil {
		return
	}
	drained := e.use.retire()
	d := e.handler.(destroyer)
	logger := logging.FromContext(ctx)
	go func() {
		warn := time.NewTimer(retiredDrainWarning)
		defer warn.Stop()
		select {
		case <-drained:
		case <-warn.C:
			logger.Warn("router: retired handler still serving requests, waiting to destroy it", "group", group)
			<-drained
		}
		d.Destroy()
	}()
}

// serve runs one request on the entry's handler through its breaker. An
// entry retired after the caller looked it up refuses the request, since its
// handler may be about to be destroyed; the client retries against the
// snapshot that replaced it.
func (e servingEntry) serve(group string, w http.ResponseWriter, req *http.Request) {
	if !e.use.enter() {
		w.Header().Set("Retry-After", "1")
		http.Error(w, "route for group "+group+" changed, retry", http.StatusServiceUnavailable)
		return
	}
	defer e.use.exit()
	serveThroughBreaker(e.breaker, group, e.handler, w, req)
}
