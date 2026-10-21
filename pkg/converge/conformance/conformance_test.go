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
