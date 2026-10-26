package apply_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/converge/apply"
)

func hierarchicalPlan(t *testing.T) *converge.Plan {
	t.Helper()
	p, err := converge.NewPlan(
		[]converge.Declaration{
			{Key: "a/b/one.json", Fingerprint: "h1"},
			{Key: "a/b/two.json", Fingerprint: "h2"},
		},
		nil,
		converge.WithContainers(converge.ContainerConfig{
			Implied:          true,
			FallbackIdentity: func(k converge.Key) converge.Identity { return converge.Identity("auto:" + string(k)) },
		}),
	)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestStagesAreBarriers(t *testing.T) {
	p := hierarchicalPlan(t)

	var mu sync.Mutex
	var order []string
	inFlight, maxInFlight := 0, 0

	_, err := apply.Run(context.Background(), p, apply.ActuatorFunc(func(_ context.Context, op converge.Op) error {
		mu.Lock()
		inFlight++
		if inFlight > maxInFlight {
			maxInFlight = inFlight
		}
		order = append(order, op.Kind.String()+" "+string(op.Key))
		mu.Unlock()

		time.Sleep(time.Millisecond)

		mu.Lock()
		inFlight--
		mu.Unlock()
		return nil
	}), apply.Config{Workers: 4})
	if err != nil {
		t.Fatal(err)
	}

	// Containers come before their contents whatever the worker count.
	if order[0] != "ensure-container a/" || order[1] != "ensure-container a/b/" {
		t.Fatalf("containers were not ensured first: %v", order)
	}
	if maxInFlight < 2 {
		t.Fatalf("the two creates should have overlapped, max in flight was %d", maxInFlight)
	}
}

func TestFailurePropagatesToDependents(t *testing.T) {
	p := hierarchicalPlan(t)
	boom := errors.New("boom")

	res, err := apply.Run(context.Background(), p, apply.ActuatorFunc(func(_ context.Context, op converge.Op) error {
		if op.Kind == converge.OpEnsureContainer && op.Key == "a/b/" {
			return boom
		}
		return nil
	}), apply.Config{Workers: 4, ContinueOnError: true})
	if err != nil {
		t.Fatal(err)
	}

	for _, o := range res.Outcomes {
		switch o.Op.Key {
		case "a/":
			if o.Status != apply.Applied {
				t.Fatalf("a/ should have applied, got %s", o.Status)
			}
		case "a/b/":
			if o.Status != apply.Failed {
				t.Fatalf("a/b/ should have failed, got %s", o.Status)
			}
		default:
			// Attempting a write into a container that does not exist could
			// only produce a second error saying nothing the first did not.
			if o.Status != apply.Skipped {
				t.Fatalf("%s should have been skipped, got %s", o.Op.Key, o.Status)
			}
		}
	}
	if res.Converged() {
		t.Fatal("a run with a failure has not converged")
	}
	if len(res.Errors()) != 1 || !errors.Is(res.Errors()[0], boom) {
		t.Fatalf("unexpected errors %v", res.Errors())
	}
}

func TestSerialKindsDoNotOverlap(t *testing.T) {
	p, err := converge.NewPlan(
		[]converge.Declaration{
			{Key: "a/one.json", Fingerprint: "h1"},
			{Key: "b/two.json", Fingerprint: "h2"},
			{Key: "c/three.json", Fingerprint: "h3"},
		},
		nil,
		converge.WithContainers(converge.ContainerConfig{Implied: true}),
	)
	if err != nil {
		t.Fatal(err)
	}

	var concurrent, peak int32
	_, err = apply.Run(context.Background(), p, apply.ActuatorFunc(func(_ context.Context, op converge.Op) error {
		if op.Kind != converge.OpEnsureContainer {
			return nil
		}
		n := atomic.AddInt32(&concurrent, 1)
		for {
			old := atomic.LoadInt32(&peak)
			if n <= old || atomic.CompareAndSwapInt32(&peak, old, n) {
				break
			}
		}
		time.Sleep(2 * time.Millisecond)
		atomic.AddInt32(&concurrent, -1)
		return nil
	}), apply.Config{Workers: 8, Serial: []converge.OpKind{converge.OpEnsureContainer}})
	if err != nil {
		t.Fatal(err)
	}
	if peak != 1 {
		t.Fatalf("serial kind ran %d at a time", peak)
	}
}

func TestOperationIsAlwaysBounded(t *testing.T) {
	p := hierarchicalPlan(t)

	res, err := apply.Run(context.Background(), p, apply.ActuatorFunc(func(ctx context.Context, _ converge.Op) error {
		<-ctx.Done()
		return ctx.Err()
	}), apply.Config{Workers: 2, OpTimeout: 10 * time.Millisecond, ContinueOnError: true})
	if err != nil {
		t.Fatal(err)
	}
	if res.Applied != 0 {
		t.Fatalf("a hanging actuator should apply nothing, got %d", res.Applied)
	}
	if res.Failed == 0 {
		t.Fatal("a hanging actuator should be reported as failing")
	}
}

func TestCancellationStopsScheduling(t *testing.T) {
	p := hierarchicalPlan(t)
	ctx, cancel := context.WithCancel(context.Background())

	var ran int32
	res, err := apply.Run(ctx, p, apply.ActuatorFunc(func(_ context.Context, _ converge.Op) error {
		atomic.AddInt32(&ran, 1)
		cancel()
		return nil
	}), apply.Config{Workers: 1})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("want context.Canceled, got %v", err)
	}
	if res.NotAttempted == 0 {
		t.Fatal("cancellation should leave operations not attempted")
	}
	if res.Converged() {
		t.Fatal("a cancelled run has not converged")
	}
}

func TestDispatcherRoutesByKind(t *testing.T) {
	p := hierarchicalPlan(t)
	var creates, ensures int

	_, err := apply.Run(context.Background(), p, apply.Dispatcher{
		Create:          func(context.Context, converge.Op) error { creates++; return nil },
		EnsureContainer: func(context.Context, converge.Op) error { ensures++; return nil },
	}, apply.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if creates != 2 || ensures != 2 {
		t.Fatalf("creates=%d ensures=%d", creates, ensures)
	}
}

func TestEmptyPlanConverges(t *testing.T) {
	res, err := apply.Run(context.Background(), &converge.Plan{}, apply.ActuatorFunc(
		func(context.Context, converge.Op) error { return errors.New("must not be called") },
	), apply.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Converged() {
		t.Fatal("an empty plan has converged by definition")
	}
}

func TestRunDoesNotPanicOnANilPlan(t *testing.T) {
	res, err := apply.Run(context.Background(), nil, apply.ActuatorFunc(
		func(context.Context, converge.Op) error { return errors.New("must not be called") },
	), apply.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Converged() {
		t.Fatal("a nil plan has nothing to do")
	}
}

func TestHaltStopsSchedulingWithinAStage(t *testing.T) {
	// The breaker is documented as consulted per operation. Checking it only
	// between stages lets a wide stage run every one of its failures after the
	// threshold has already tripped.
	p, err := converge.NewPlan(
		[]converge.Declaration{
			{Key: "a/one.json", Fingerprint: "h1"},
			{Key: "a/two.json", Fingerprint: "h2"},
			{Key: "a/three.json", Fingerprint: "h3"},
			{Key: "a/four.json", Fingerprint: "h4"},
		},
		[]converge.Observation{{Key: "a/", Identity: "F", Container: true}},
		converge.WithContainers(converge.ContainerConfig{Implied: true}),
	)
	if err != nil {
		t.Fatal(err)
	}

	var attempts int32
	tripped := errors.New("too many errors")
	res, err := apply.Run(context.Background(), p, apply.ActuatorFunc(
		func(context.Context, converge.Op) error {
			atomic.AddInt32(&attempts, 1)
			return nil
		},
	), apply.Config{
		Workers: 1,
		Halt: func() error {
			if atomic.LoadInt32(&attempts) >= 1 {
				return tripped
			}
			return nil
		},
	})
	if !errors.Is(err, tripped) {
		t.Fatalf("want the halt error, got %v", err)
	}
	if got := atomic.LoadInt32(&attempts); got > 2 {
		t.Fatalf("the breaker should stop scheduling, but %d operations ran", got)
	}
	if res.Converged() {
		t.Fatal("a halted run has not converged")
	}
}

// Failure has to propagate through a skip, not stop at it. Marking a blocked
// operation Skipped without recording it as unsatisfied held back only its
// direct dependents, so a write two levels under a failed container was
// attempted and reported applied.
func TestFailurePropagatesThroughSkippedPrerequisites(t *testing.T) {
	p := hierarchicalPlan(t)
	boom := errors.New("boom")

	var attempted []string
	res, err := apply.Run(context.Background(), p, apply.ActuatorFunc(func(_ context.Context, op converge.Op) error {
		attempted = append(attempted, string(op.Key))
		if op.Kind == converge.OpEnsureContainer && op.Key == "a/" {
			return boom
		}
		return nil
	}), apply.Config{Workers: 1, ContinueOnError: true})
	if err != nil {
		t.Fatal(err)
	}

	if len(attempted) != 1 || attempted[0] != "a/" {
		t.Fatalf("nothing under the failed container should have been attempted, got %v", attempted)
	}
	for _, o := range res.Outcomes {
		want := apply.Skipped
		if o.Op.Key == "a/" {
			want = apply.Failed
		}
		if o.Status != want {
			t.Fatalf("%s: want %s, got %s", o.Op.Key, want, o.Status)
		}
	}
}
