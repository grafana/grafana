package schema

import (
	"sync"

	"github.com/grafana/thema"
	"k8s.io/apimachinery/pkg/runtime"
)

// GoSchema contains a Grafana schema where the canonical schema expression is made
// with Go types, in traditional Kubernetes style.
type GoSchema struct {
	Kind string
	// TODO figure out what fields should be here
	SB *runtime.SchemeBuilder
}

// SchemeBuilder returns a runtime.SchemeBuilder for this object kind.
func (gs *GoSchema) SchemeBuilder() *runtime.SchemeBuilder {
	return gs.SB
}

// Name returns the canonical string that identifies the object being schematized.
func (gs *GoSchema) Name() string {
	return gs.Kind
}

// Name returns the canonical string that identifies the object being schematized.
func (ts *ThemaSchema) Name() string {
	return ts.Lineage.Name()
}

// ThemaSchema contains a Grafana schema where the canonical schema expression
// is made with Thema and CUE.
type ThemaSchema struct {
	// TODO figure out what fields should be here
	Lineage thema.Lineage
}

// SchemeBuilder returns a runtime.SchemeBuilder that will accurately represent
// the authorial intent of the Thema lineage to Kubernetes.
func (ts *ThemaSchema) SchemeBuilder() *runtime.SchemeBuilder {
	panic("TODO")
}

// A ObjectSchema returns a SchemeBuilder. Produced by schema components
// to make their schema available to things relying on k8s
type ObjectSchema interface {
	Name() string
	SchemeBuilder() *runtime.SchemeBuilder
}

// CoreRegistry is a registry for Grafana core (compile-time-known)
// k8s-compatible schemas.
//
// TODO we need(?) these to have distinct type identities for wire, component
// conditions, and type aliases don't give us that
type CoreRegistry = schemaRegistry

// underlying type for all schema registries. Create type aliases as needed,
// because referencing these in other Go code will likely trigger component
// group condition rules
type schemaRegistry struct {
	M sync.Map
}

var cr *CoreRegistry = &CoreRegistry{}

// ProvideCoreRegistry provides the CoreRegistry instance that collects all core
// (knowable at compile time) schemas.
func ProvideCoreRegistry() *CoreRegistry {
	return cr
}

func (r *schemaRegistry) Store(sch ObjectSchema) {
	r.M.Store(sch.Name(), sch)
}

func (r *schemaRegistry) Load(name string) (ObjectSchema, bool) {
	sch, ok := r.M.Load(name)
	return sch.(ObjectSchema), ok
}
