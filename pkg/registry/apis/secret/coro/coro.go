package coro

import (
	"slices"
)

var CurrentCoroutine Coroutine

func Yield() any {
	if CurrentCoroutine == nil {
		panic("CurrentCoroutine is nil, did you forget to set it? Make sure Yield is called inside of a runtime")
	}

	CurrentCoroutine.ReadyToResume(nil)

	return CurrentCoroutine.Yield()
}

func YieldAndWait() any {
	if CurrentCoroutine == nil {
		panic("CurrentCoroutine is nil, did you forget to set it?")
	}

	return CurrentCoroutine.Yield()
}

type Coroutine interface {
	// The coroutine yields to the runtime
	Yield() any
	// Returns true when the coroutine is done
	Resume(any) bool
	// Resumes the coroutine with the value
	ReadyToResume(any)
}

type CoroutineImpl struct {
	runtime *Runtime
	resume  func(any) bool
	yield   func() any
}

func newCoroutineImpl(runtime *Runtime, resume func(any) bool, yield func() any) *CoroutineImpl {
	return &CoroutineImpl{runtime: runtime, resume: resume, yield: yield}
}

func (c *CoroutineImpl) Yield() any {
	return c.yield()
}
func (c *CoroutineImpl) Resume(v any) bool {
	temp := CurrentCoroutine

	CurrentCoroutine = c

	c.runtime.ReadySet = slices.DeleteFunc(c.runtime.ReadySet, func(r ready) bool {
		return r.Coroutine.(*CoroutineImpl) == c
	})

	done := c.resume(v)

	CurrentCoroutine = temp

	return done
}
func (c *CoroutineImpl) ReadyToResume(payload any) {
	c.runtime.readyToResume(c, payload)
}

type Runtime struct {
	ReadySet []ready
}

type ready struct {
	Coroutine Coroutine
	Payload   any
}

func NewRuntime() *Runtime {
	return &Runtime{}
}

type msg struct {
	panic any
}

// Returns true when there's at least one coroutine that's waiting to be resumed
func (runtime *Runtime) HasCoroutinesReady() bool {
	return len(runtime.ReadySet) > 0
}

func (runtime *Runtime) readyToResume(coroutine Coroutine, payload any) {
	runtime.ReadySet = append(runtime.ReadySet, ready{Coroutine: coroutine, Payload: payload})
}

func (runtime *Runtime) Spawn(f func()) Coroutine {
	cin := make(chan any)
	cout := make(chan msg)
	done := false
	resume := func(in any) (ok bool) {
		if done {
			return true
		}
		cin <- in
		m := <-cout
		if m.panic != nil {
			panic(m.panic)
		}
		return done
	}
	yield := func() any {
		cout <- msg{}
		return <-cin
	}

	coroutine := newCoroutineImpl(runtime, resume, yield)
	runtime.readyToResume(coroutine, nil)

	go func() {
		defer func() {
			if !done {
				done = true
				// cout <- msg{panic: recover()}
				cout <- msg{panic: nil}
			}
		}()
		<-cin
		f()
		done = true
		cout <- msg{}
	}()
	return coroutine
}
