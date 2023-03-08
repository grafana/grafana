package corecrd

import (
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/thema"
)

// New constructs a new [Registry].
//
// All calling code within grafana/grafana is expected to use Grafana's
// singleton [thema.Runtime], returned from [cuectx.GrafanaThemaRuntime]. If nil
// is passed, the singleton will be used.
func New(rt *thema.Runtime) *Registry {
	breg := corekind.NewBase(rt)
	return doNewRegistry(breg)
}

// All returns a slice of all core Grafana CRDs in the registry.
//
// The returned slice is guaranteed to be alphabetically sorted by kind name.
func (r *Registry) All() []k8ssys.Kind {
	all := make([]k8ssys.Kind, len(r.all))
	copy(all, r.all[:])
	return all
}
