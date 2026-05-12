package kv

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
)

// ErrKVUnavailable is returned by EventualKVProvider.Get when the storage
// backend resolved to no local KV (e.g. storage_type=unified-grpc, or any
// other configuration that does not produce a KV on this instance).
var ErrKVUnavailable = errors.New("no KV store available in this configuration")

var providerLog = log.New("eventual-kv-provider")

// EventualKVProvider is a deferred KV store reference.
//
// All methods are safe for concurrent use. Set and SetUnavailable follow
// first-call-wins semantics: once resolved, subsequent calls are no-ops
// and log a warning identifying the duplicate caller. Callers may pass a
// nil *EventualKVProvider; all methods become no-ops in that case (and
// Get blocks until ctx is cancelled).
type EventualKVProvider struct {
	once  sync.Once
	ready chan struct{}
	store KV
}

func ProvideEventualKVStore() *EventualKVProvider {
	return &EventualKVProvider{
		ready: make(chan struct{}),
	}
}

// Set marks the provider as resolved with the given KV store and unblocks
// all Get callers. First call wins; subsequent Set or SetUnavailable calls
// are ignored with a warning log.
func (p *EventualKVProvider) Set(store KV) {
	if p == nil {
		return
	}
	ran := false
	p.once.Do(func() {
		p.store = store
		close(p.ready)
		ran = true
	})
	if !ran {
		logDuplicate("Set")
	}
}

// SetUnavailable marks the provider as resolved with no KV; Get will then
// return ErrKVUnavailable. First call wins; subsequent Set or
// SetUnavailable calls are ignored with a warning log.
func (p *EventualKVProvider) SetUnavailable() {
	if p == nil {
		return
	}
	ran := false
	p.once.Do(func() {
		close(p.ready)
		ran = true
	})
	if !ran {
		logDuplicate("SetUnavailable")
	}
}

// Get blocks until Set or SetUnavailable is called, or until ctx is
// cancelled. Returns ErrKVUnavailable if the provider was resolved with no
// KV. On a nil receiver, blocks until ctx is cancelled.
func (p *EventualKVProvider) Get(ctx context.Context) (KV, error) {
	if p == nil {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	select {
	case <-p.ready:
		if p.store == nil {
			return nil, ErrKVUnavailable
		}
		return p.store, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// logDuplicate emits a warning when Set or SetUnavailable is called after
// the provider has already been resolved. skip=2 walks past logDuplicate
// and Set/SetUnavailable to surface the offending call site.
func logDuplicate(method string) {
	caller := "unknown"
	if _, file, line, ok := runtime.Caller(2); ok {
		caller = fmt.Sprintf("%s:%d", filepath.Base(file), line)
	}
	providerLog.Warn("EventualKVProvider already resolved; ignoring duplicate call",
		"method", method, "caller", caller)
}
