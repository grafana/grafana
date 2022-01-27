package schema

import (
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/grafana/thema"
	"k8s.io/apimachinery/pkg/runtime"
)

// Package state backing for RegisterCoreSchema.
var cr *CoreRegistry

// atomic guard on registry
var regguard int32

// RegisterCoreSchema registers a core schema, storing it in package-level
// state.
//
// This is decidedly not-good - package-level registries are an antipattern for
// both testing and possible buggy duplicate registration reasons: https://dave.cheney.net/2017/06/11/go-without-package-scoped-variables
//
// However, it's quite difficult to get wire to accept a slice of the same type.
// There's been discussion, but it seems dead:
// https://github.com/google/wire/issues/207
//
// Without that, there'd have to be a lot of explicit enumeration of types on
// the provider side (each schema component would need to make its own
// type-identity of ThemaSchema or GoSchema, and that's horribly verbose.) Then,
// that would all have to be repeated in the arguments to the constructor called
// by the injector func to actually return a properly-populated CoreRegistry.
//
// NOTE: Attempting to registering the same schema name twice will panic.
// Attempting to call this from anywhere but an init function is likely to
// panic.
func RegisterCoreSchema(sch ObjectSchema) {
	// panic if guard has been set by a read
	if !atomic.CompareAndSwapInt32(&regguard, 0, 0) {
		panic("do not call RegisterCoreSchema() outside of an init() function; core registry has been read from and may no longer be written to;")
	}

	// panic on duplicate. It's not impossible that this would be hit, but it's
	// better to do it now rather than risk profoundly confusing errors later,
	// given that we at least theoretically have recourse have recourse to
	// refactor to get away from this global state via wire
	if _, has := cr.Load(sch.Name()); has {
		panic(fmt.Sprintf("core object schema with name %s already exists", sch.Name()))
	}
	cr.Store(sch)
}

func LoadCoreSchema(name string) (ObjectSchema, bool) {
	// No more writes allowed
	atomic.CompareAndSwapInt32(&regguard, 0, 1)
	return cr.Load(name)
}

// ProvideReadOnlyCoreRegistry provides a listing of all known core ObjectSchema
// - those known at compile time.
//
// We return a (slice of) interfaces here. That's against the guidance to return
// concrete types with wire, but we have no choice, as our inputs are interfaces.
func ProvideReadOnlyCoreRegistry() CoreSchemaList {
	// No more writes allowed
	atomic.CompareAndSwapInt32(&regguard, 0, 1)

	var sl []ObjectSchema
	cr.M.Range(func(key, value interface{}) bool {
		sl = append(sl, value.(ObjectSchema))
		return true
	})
	return sl
}

type CoreSchemaList []ObjectSchema

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

func (r *schemaRegistry) Store(sch ObjectSchema) {
	r.M.Store(sch.Name(), sch)
}

func (r *schemaRegistry) Load(name string) (ObjectSchema, bool) {
	sch, ok := r.M.Load(name)
	return sch.(ObjectSchema), ok
}
