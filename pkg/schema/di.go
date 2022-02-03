package schema

import (
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/grafana/thema"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

// Package state backing for RegisterCoreSchema.
var cr *CoreRegistry = &CoreRegistry{}

// atomic guard on registry
var regguard int32

var schm *runtime.Scheme = runtime.NewScheme()

var (
	groupName    = "grafana.ap.group"
	groupVersion = "v1"
	once         sync.Once
)

func getCoreRegistry() *CoreRegistry {
	once.Do(func() {
		schemaGroupVersion := schema.GroupVersion{Group: groupName, Version: groupVersion}
		cr = &CoreRegistry{
			schemeBuilder: &scheme.Builder{GroupVersion: schemaGroupVersion},
		}
	})
	fmt.Println("<<<<", cr)
	return cr
}

func GetScheme() *runtime.Scheme {
	return schm
}

func GetAddToScheme() func(*runtime.Scheme) error {
	return getCoreRegistry().schemeBuilder.AddToScheme
}

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
	if _, has := getCoreRegistry().Load(sch.Name()); has {
		panic(fmt.Sprintf("core object schema with name %s already exists", sch.Name()))
	}

	getCoreRegistry().Store(sch)
	getCoreRegistry().schemeBuilder.Register(sch.GetRuntimeObjects()...)
}

func LoadCoreSchema(name string) (ObjectSchema, bool) {
	// No more writes allowed
	atomic.CompareAndSwapInt32(&regguard, 0, 1)
	return getCoreRegistry().Load(name)
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
	getCoreRegistry().M.Range(func(key, value interface{}) bool {
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
	runtimeObjects []runtime.Object
}

// GetRuntimeObjects returns a runtime.Object for this object kind.
func (gs *GoSchema) GetRuntimeObjects() []runtime.Object {
	return gs.runtimeObjects
}

// SetRuntimeObjects associates a go schema with its kubernetes runtime objects
func (gs *GoSchema) SetRuntimeObjects(objects ...runtime.Object) {
	gs.runtimeObjects = append(gs.runtimeObjects, objects...)
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
	Lineage        thema.Lineage
	runtimeObjects []runtime.Object
}

// GetRuntimeObjects returns a runtime.Object that will accurately represent
// the authorial intent of the Thema lineage to Kubernetes.
func (ts *ThemaSchema) GetRuntimeObjects() []runtime.Object {
	return ts.runtimeObjects
}

// SetRuntimeObjects associates a thema schema with its kubernetes runtime objects
func (ts *ThemaSchema) SetRuntimeObjects(objects ...runtime.Object) {
	ts.runtimeObjects = append(ts.runtimeObjects, objects...)
}

// A ObjectSchema returns a SchemeBuilder. Produced by schema components
// to make their schema available to things relying on k8s
type ObjectSchema interface {
	Name() string
	SetRuntimeObjects(...runtime.Object)
	GetRuntimeObjects() []runtime.Object
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
	M             sync.Map
	schemeBuilder *scheme.Builder
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
