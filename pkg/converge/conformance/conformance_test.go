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
