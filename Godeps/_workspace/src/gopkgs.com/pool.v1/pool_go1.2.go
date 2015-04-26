// +build !go1.3 appengine

package pool

import (
	"runtime"
)

// Pool is a thin compatibility type to allow Go
// libraries to use the new sync.Pool in Go  1.3,
// while remaining compatible with lower Go versions.
// For more information, see the sync.Pool type.
type Pool struct {
	ch chan interface{}
	// New specifies a function to generate
	// a new value, when Get would otherwise
	// return nil.
	New func() interface{}
}

// New returns a new Pool. The size argument is
// ignored on Go >= 1.3. In Go < 1.3, if size is
// zero, it's set to runtime.GOMAXPROCS(0) * 2.
func New(size int) *Pool {
	if size == 0 {
		size = runtime.GOMAXPROCS(0) * 2
	}
	return &Pool{ch: make(chan interface{}, size)}
}

// Get returns an arbitrary previously Put value, removing
// it from the pool, or nil if there are no such values. Note
// that callers should not assume anything about the Get return
// value, since the runtime might decide to collect the elements
// from the pool at any time.
//
// If there are no elements to return and the New() field is non-nil,
// Get returns the result of calling it.
func (p *Pool) Get() interface{} {
	select {
	case x := <-p.ch:
		return x
	default:
	}
	if p.New != nil {
		return p.New()
	}
	return nil
}

// Put adds x to the pool.
func (p *Pool) Put(x interface{}) {
	select {
	case p.ch <- x:
	default:
	}
}
