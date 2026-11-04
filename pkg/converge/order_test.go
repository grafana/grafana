package converge_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/converge"
)

// Order gives a caller that computed its own diff the same ordering
// guarantees, provided it fills in Container.
func TestOrderFromCallerBuiltOps(t *testing.T) {
	ops := []converge.Op{
		{Kind: converge.OpCreate, Key: "a/b/c.json", Container: "a/b/"},
		{Kind: converge.OpEnsureContainer, Key: "a/b/", Container: "a/"},
		{Kind: converge.OpEnsureContainer, Key: "a/"},
	}

	p, err := converge.Order(ops, converge.ModeFull, converge.ScopeConvergent)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Stages) != 3 {
		t.Fatalf("want three stages, got %d:\n%s", len(p.Stages), p)
	}
	if p.Stages[0][0].Key != "a/" || p.Stages[2][0].Key != "a/b/c.json" {
		t.Fatalf("wrong order:\n%s", p)
	}
}

func TestOrderPutsRemovalsDeepestFirst(t *testing.T) {
	ops := []converge.Op{
		{Kind: converge.OpRemoveContainer, Key: "a/", Identity: "A"},
		{Kind: converge.OpRemoveContainer, Key: "a/b/", Identity: "B", Container: "a/"},
		{Kind: converge.OpDelete, Key: "a/b/c.json", Identity: "C", Container: "a/b/"},
	}
	p, err := converge.Order(ops, converge.ModeFull, converge.ScopeConvergent)
	if err != nil {
		t.Fatal(err)
	}
	seq := make([]string, 0, len(p.Ops))
	for _, op := range p.Ops {
		seq = append(seq, string(op.Key))
	}
	want := []string{"a/b/c.json", "a/b/", "a/"}
	for i := range want {
		if seq[i] != want[i] {
			t.Fatalf("want %v, got %v:\n%s", want, seq, p)
		}
	}
}

// A container being re-identified is ensured under its new identity and
// removed under its old one at the same key. Anything landing in that
// container must re-parent before the old one goes, or it is stranded.
//
// A write populates a container rather than vacating it, so no vacating edge
// covers this. The rule has to be derived here, because a consumer that
// assembled the operations itself has no reason to know it exists.
func TestOrderReparentsBeforeRemovingTheOldContainer(t *testing.T) {
	ops := []converge.Op{
		{Kind: converge.OpRemoveContainer, Key: "f/", Identity: "old"},
		{Kind: converge.OpEnsureContainer, Key: "f/", Identity: "new"},
		{Kind: converge.OpUpdate, Key: "f/dash.json", Identity: "d1", Container: "f/"},
	}

	p, err := converge.Order(ops, converge.ModeFull, converge.ScopeConvergent)
	if err != nil {
		t.Fatal(err)
	}

	seq := make([]string, 0, len(p.Ops))
	for _, op := range p.Ops {
		seq = append(seq, op.Kind.String()+" "+string(op.Key))
	}
	want := []string{"ensure-container f/", "update f/dash.json", "remove-container f/"}
	for i := range want {
		if seq[i] != want[i] {
			t.Fatalf("want %v, got %v:\n%s", want, seq, p)
		}
	}
}
