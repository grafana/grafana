// +build go1.3,!appengine

package pool

import (
	"sync"
)

// Pool is a thin compatibility type to allow Go
// libraries to use the new sync.Pool in Go  1.3,
// while remaining compatible with lower Go versions.
// For more information, see the sync.Pool type.
type Pool sync.Pool

// New returns a new Pool. The size argument is
// ignored on Go >= 1.3. In Go < 1.3, if size is
// zero, it's set to runtime.GOMAXPROCS(0) * 2.
func New(size int) *Pool {
	return &Pool{}
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
	return (*sync.Pool)(p).Get()
}

// Put adds x to the pool.
func (p *Pool) Put(x interface{}) {
	(*sync.Pool)(p).Put(x)
}
