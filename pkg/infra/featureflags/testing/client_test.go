package testing

import (
	"golang.org/x/net/context"
	"sync"
	"testing"
)

type Barrier struct {
	count  int
	target int

	mutex sync.Mutex
	cond  *sync.Cond
}

func NewBarrier(target int) *Barrier {
	barrier := &Barrier{
		target: target,
		mutex:  sync.Mutex{},
	}

	barrier.cond = sync.NewCond(&barrier.mutex)
	return barrier
}

func (b *Barrier) Wait() {
	b.mutex.Lock()
	b.count++
	if b.count == b.target {
		b.cond.Broadcast()
	} else {
		b.cond.Wait()
	}
	b.mutex.Unlock()
}

var (
	FlagFoo    = FeatureFlag{Name: "foo", Value: true}
	FlagBar    = FeatureFlag{Name: "bar", Value: true}
	FlagBaz    = FeatureFlag{Name: "baz", Value: true}
	FlagFoobar = FeatureFlag{Name: "foobar", Value: true}

	barrier1 = NewBarrier(2)
	barrier2 = NewBarrier(2)
)

func Test_Parallel_GoroutineA(t *testing.T) {
	t.Parallel()

	// Initialise the Test Client and set up the test flag
	client := NewTestClient()
	client.SetFeatureFlags(t, FlagFoo)

	barrier1.Wait()
	barrier2.Wait()
	if !client.IsEnabled(context.Background(), FlagFoo.Name) {
		t.Fatalf("expected %s to be enabled", FlagFoo.Name)
	}
}

func Test_Parallel_GoroutineB(t *testing.T) {
	t.Parallel()

	barrier1.Wait()

	// Initialise the Test Client and set up the test flag
	client := NewTestClient()
	client.SetFeatureFlags(t, FlagBar)

	barrier2.Wait()

	if !client.IsEnabled(context.Background(), FlagBar.Name) {
		t.Fatalf("expected %s to be disabled", FlagBar.Name)
	}
}

func Test_Sequential(t *testing.T) {
	client := NewTestClient()

	tests := []FeatureFlag{FlagBaz, FlagFoobar}

	for _, flag := range tests {
		client.SetFeatureFlags(t, flag)

		if !client.IsEnabled(context.Background(), flag.Name) {
			t.Fatalf("expected %s to be disabled", flag.Name)
		}
	}
}
