package schema

import (
	"fmt"
	"sync"
	"sync/atomic"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// SchemaType is the type of ObjectSchema (Go / Thema / etc.).
type SchemaType int

// Known schema types.
const (
	SchemaTypeUnknown SchemaType = iota
	SchemaTypeThema
	SchemaTypeGo
)

// A ObjectSchema returns a SchemeBuilder. Produced by schema components
// to make their schema available to things relying on k8s
type ObjectSchema interface {
	Name() string
	GroupName() string
	GroupVersion() string
	OpenAPISchema() apiextensionsv1.JSONSchemaProps
	RuntimeObjects() []runtime.Object
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
	if sch, ok := r.M.Load(name); ok {
		return sch.(ObjectSchema), ok
	}
	return nil, false
}

// Package state backing for RegisterCoreSchema.
var cr *CoreRegistry = &CoreRegistry{}

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

// TODO: remove after registry in components is done.
// CoreSchemaList
type CoreSchemaList []ObjectSchema

// ProvideReadonlyCoreSchemaList provides a listing of all known core ObjectSchema
// - those known at compile time.
//
// We return a (slice of) interfaces here. That's against the guidance to return
// concrete types with wire, but we have no choice, as our inputs are interfaces.
func ProvideReadonlyCoreSchemaList() CoreSchemaList {
	// No more writes allowed
	atomic.CompareAndSwapInt32(&regguard, 0, 1)

	var sl []ObjectSchema
	cr.M.Range(func(key, value interface{}) bool {
		sl = append(sl, value.(ObjectSchema))
		return true
	})
	return sl
}
