package conformance_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/converge/conformance"
)

// A hierarchical target whose containers take an identity derived from the
// key: the shape a consumer with folders has.
func TestHierarchicalTarget(t *testing.T) {
	conformance.Check(t, conformance.Options{
		Containers: converge.ContainerConfig{
			Implied:          true,
			FallbackIdentity: func(k converge.Key) converge.Identity { return converge.Identity("auto:" + string(k)) },
		},
		Cases: 200,
	})
}

// A hierarchical target whose containers have no identity of their own, so
// existence is the only requirement.
func TestIdentityAgnosticContainers(t *testing.T) {
	conformance.Check(t, conformance.Options{
		Containers: converge.ContainerConfig{Implied: true},
		Cases:      200,
	})
}

// A flat target: no containers at all.
func TestFlatTarget(t *testing.T) {
	conformance.Check(t, conformance.Options{Cases: 200})
}

// A container's own content has to survive the round trip through apply and
// back into the inventory. If the model drops it, re-planning produces another
// content change and the suite cannot check idempotence for any container that
// carries metadata — which is every folder with a _folder.json.
func TestContainerContentRoundTrips(t *testing.T) {
	cfg := converge.ContainerConfig{
		Implied:          true,
		FallbackIdentity: func(k converge.Key) converge.Identity { return converge.Identity("auto:" + string(k)) },
	}
	desired := []converge.Declaration{
		{Key: "f/", Container: true, Identity: "F1", Fingerprint: "m1"},
		{Key: "f/one.json", Fingerprint: "h1"},
	}

	model := conformance.NewModel(true)
	first, err := converge.NewPlan(desired, model.Inventory(), converge.WithContainers(cfg))
	if err != nil {
		t.Fatal(err)
	}
	if err := model.Apply(first); err != nil {
		t.Fatalf("plan is unsafe: %v", err)
	}

	again, err := converge.NewPlan(desired, model.Inventory(), converge.WithContainers(cfg))
	if err != nil {
		t.Fatal(err)
	}
	if !again.Empty() {
		t.Fatalf("the container's content did not survive the round trip:\n%s", again)
	}
}

// The model must reject a stage whose members are not independent. Applying a
// stage in slice order accepts an ensure followed by a write into it, because
// the favourable order hides the missing dependency edge; under the concurrency
// a stage promises, the write can run first.
func TestModelRejectsAStageThatIsNotIndependent(t *testing.T) {
	ensure := converge.Op{Kind: converge.OpEnsureContainer, Key: "a/", Identity: "A"}
	create := converge.Op{
		Kind: converge.OpCreate, Key: "a/one.json", Fingerprint: "h1",
		Container: "a/", ContainerIdentity: "A",
	}
	p := &converge.Plan{
		Ops:    []converge.Op{ensure, create},
		Stages: [][]converge.Op{{ensure, create}},
	}

	m := conformance.NewModel(true)
	err := m.ApplyStages(p)
	if err == nil {
		t.Fatal("a stage containing an ensure and a write into it is not independent")
	}
	t.Log(err)
}

// A container's identity, not just its path, is what a child is parented to.
// Accepting any container at the path lets a plan re-parent a child to an
// identity that does not exist yet — the unsafe half of a re-identification.
func TestModelRejectsReparentingToAnIdentityThatIsNotHeldYet(t *testing.T) {
	m := conformance.NewModel(true)
	m.Containers["a/"] = []conformance.HeldContainer{{Identity: "OLD"}}
	m.Entities["a/one.json"] = conformance.Entry{Identity: "E1", Fingerprint: "h1", Parent: "OLD"}

	reparent := converge.Op{
		Kind: converge.OpUpdate, Key: "a/one.json", Identity: "E1", Fingerprint: "h1",
		Container: "a/", ContainerIdentity: "NEW", Reason: converge.ReasonReparent,
	}
	err := m.ApplyStages(&converge.Plan{
		Ops:    []converge.Op{reparent},
		Stages: [][]converge.Op{{reparent}},
	})
	if err == nil {
		t.Fatal("re-parenting to NEW before NEW exists must be rejected")
	}
	t.Log(err)
}
