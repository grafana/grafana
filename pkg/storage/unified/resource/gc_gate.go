package resource

import (
	"context"
	"sync"
)

// GCGate defers background GC until Release is called.
type GCGate struct {
	once sync.Once
	ch   chan struct{}
}

// NewGCGate returns an un-released gate; Wait blocks until Release is called.
func NewGCGate() *GCGate { return &GCGate{ch: make(chan struct{})} }

// Release unblocks Wait callers.
func (g *GCGate) Release() {
	if g == nil || g.ch == nil {
		return
	}
	g.once.Do(func() { close(g.ch) })
}

// Wait blocks until the gate is released, returning true to proceed. It returns
// false if the caller should abort (context cancelled or done closed).
// A nil gate returns true immediately.
func (g *GCGate) Wait(ctx context.Context, done <-chan struct{}) bool {
	if g == nil || g.ch == nil {
		return true
	}
	select {
	case <-g.ch:
		return true
	case <-done:
		return false
	case <-ctx.Done():
		return false
	}
}
