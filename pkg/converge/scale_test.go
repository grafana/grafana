package converge_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/converge"
)

// A hundred thousand entities is the stated target. This does not assert a
// wall-clock bound — that would be flaky on shared CI — but it does fail by
// timeout if an accidental quadratic is reintroduced, and it checks that the
// plan is right at a size where hand-written fixtures cannot reach.
func TestScalesToOneHundredThousand(t *testing.T) {
	if testing.Short() {
		t.Skip("scale test")
	}
	const n = 100_000

	t.Run("steady state", func(t *testing.T) {
		decls, obs := fleet(n)
		p, err := converge.NewPlan(decls, obs, converge.WithContainers(benchConfig()))
		if err != nil {
			t.Fatal(err)
		}
		// A quarter of the fleet is absent from the target and must be created;
		// the rest matches and must produce nothing.
		counts := p.Counts()
		if got := counts[converge.OpCreate]; got != n/4 {
			t.Fatalf("want %d creates, got %d", n/4, got)
		}
		if got := counts[converge.OpUpdate]; got != 0 {
			t.Fatalf("unchanged entities must not be rewritten, got %d updates", got)
		}
		if got := counts[converge.OpDelete]; got != 0 {
			t.Fatalf("nothing should be deleted, got %d", got)
		}
	})

	t.Run("from empty", func(t *testing.T) {
		decls, _ := fleet(n)
		p, err := converge.NewPlan(decls, nil, converge.WithContainers(benchConfig()))
		if err != nil {
			t.Fatal(err)
		}
		if got := p.Counts()[converge.OpCreate]; got != n {
			t.Fatalf("want %d creates, got %d", n, got)
		}
		// Containers nest three deep, so there are three ensure stages before
		// the one wide stage of writes. More than a handful means the ordering
		// has started serialising work it did not have to.
		if len(p.Stages) > 6 {
			t.Fatalf("want a handful of stages, got %d", len(p.Stages))
		}
		last := p.Stages[len(p.Stages)-1]
		if len(last) != n {
			t.Fatalf("the writes should form one wide stage, got %d of %d", len(last), n)
		}
	})

	t.Run("teardown", func(t *testing.T) {
		_, obs := fleet(n)
		p, err := converge.NewPlan(nil, obs, converge.WithContainers(benchConfig()))
		if err != nil {
			t.Fatal(err)
		}
		counts := p.Counts()
		if counts[converge.OpDelete] == 0 || counts[converge.OpRemoveContainer] == 0 {
			t.Fatalf("teardown must delete and remove: %v", counts)
		}
	})

	t.Run("stages share one backing array", func(t *testing.T) {
		decls, obs := fleet(n)
		p, err := converge.NewPlan(decls, obs, converge.WithContainers(benchConfig()))
		if err != nil {
			t.Fatal(err)
		}
		total := 0
		for _, s := range p.Stages {
			total += len(s)
		}
		if total != len(p.Ops) {
			t.Fatalf("stages hold %d, plan holds %d", total, len(p.Ops))
		}
		// Appending to a stage must not reach into the next one.
		if len(p.Stages) > 1 && cap(p.Stages[0]) != len(p.Stages[0]) {
			t.Fatalf("stage 0 has slack capacity, so appending to it would corrupt stage 1")
		}
	})
}
