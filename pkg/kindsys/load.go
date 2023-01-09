package kindsys

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
)

// CoreDeclParentPath is the path, relative to the repository root, where
// each child directory is expected to contain .cue files declaring one
// Core kind.
var CoreDeclParentPath = "kinds"

// GoCoreKindParentPath is the path, relative to the repository root, to the directory
// containing one directory per kind, full of generated Go kind output: types and bindings.
var GoCoreKindParentPath = filepath.Join("pkg", "kinds")

// TSCoreKindParentPath is the path, relative to the repository root, to the directory that
// contains one directory per kind, full of generated TS kind output: types and default consts.
var TSCoreKindParentPath = filepath.Join("packages", "grafana-schema", "src", "raw")

var defaultFramework cue.Value
var fwOnce sync.Once

func init() {
	loadpFrameworkOnce()
}

func loadpFrameworkOnce() {
	fwOnce.Do(func() {
		var err error
		defaultFramework, err = doLoadFrameworkCUE(cuectx.GrafanaCUEContext())
		if err != nil {
			panic(err)
		}
	})
}

func doLoadFrameworkCUE(ctx *cue.Context) (cue.Value, error) {
	v, err := cuectx.BuildGrafanaInstance(ctx, filepath.Join("pkg", "kindsys"), "kindsys", nil)
	if err != nil {
		return v, err
	}

	if err = v.Validate(cue.Concrete(false), cue.All()); err != nil {
		return cue.Value{}, fmt.Errorf("kindsys framework loaded cue.Value has err: %w", err)
	}

	return v, nil
}

// CUEFramework returns a cue.Value representing all the kind framework
// raw CUE files.
//
// For low-level use in constructing other types and APIs, while still letting
// us declare all the frameworky CUE bits in a single package. Other Go types
// make the constructs in the returned cue.Value easy to use.
//
// Calling this with a nil [cue.Context] (the singleton returned from
// [cuectx.GrafanaCUEContext] is used) will memoize certain CUE operations.
// Prefer passing nil unless a different cue.Context is specifically required.
func CUEFramework(ctx *cue.Context) cue.Value {
	if ctx == nil || ctx == cuectx.GrafanaCUEContext() {
		// Ensure framework is loaded, even if this func is called
		// from an init() somewhere.
		loadpFrameworkOnce()
		return defaultFramework
	}
	// Error guaranteed to be nil here because erroring would have caused init() to panic
	v, _ := doLoadFrameworkCUE(ctx) // nolint:errcheck
	return v
}

// ToKindProps takes a cue.Value expected to represent a kind of the category
// specified by the type parameter and populates the Go type from the cue.Value.
func ToKindProps[T KindProperties](v cue.Value) (T, error) {
	props := new(T)
	if !v.Exists() {
		return *props, ErrValueNotExist
	}

	fw := CUEFramework(v.Context())
	var kdef cue.Value

	anyprops := any(*props).(SomeKindProperties)
	switch anyprops.(type) {
	case CoreProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Str("Core")))
	case CustomProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Str("Custom")))
	case ComposableProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Str("Composable")))
	default:
		// unreachable so long as all the possibilities in KindProperties have switch branches
		panic("unreachable")
	}

	item := v.Unify(kdef)
	if err := item.Validate(cue.Concrete(false), cue.All()); err != nil {
		return *props, ewrap(item.Err(), ErrValueNotAKind)
	}
	if err := item.Decode(props); err != nil {
		// Should only be reachable if CUE and Go framework types have diverged
		panic(errors.Details(err, nil))
	}

	return *props, nil
}

// SomeDecl represents a single kind declaration, having been loaded
// and validated by a func such as [LoadCoreKind].
//
// The underlying type of the Properties field indicates the category of
// kind.
type SomeDecl struct {
	// V is the cue.Value containing the entire Kind declaration.
	V cue.Value
	// Properties contains the kind's declared properties.
	Properties SomeKindProperties
}

// BindKindLineage binds the lineage for the kind declaration.
//
// For kinds with a corresponding Go type, it is left to the caller to associate
// that Go type with the lineage returned from this function by a call to
// [thema.BindType].
func (decl SomeDecl) BindKindLineage(rt *thema.Runtime, opts ...thema.BindOption) (thema.Lineage, error) {
	if rt == nil {
		rt = cuectx.GrafanaThemaRuntime()
	}
	switch decl.Properties.(type) {
	case CoreProperties, CustomProperties, ComposableProperties:
		return thema.BindLineage(decl.V.LookupPath(cue.MakePath(cue.Str("lineage"))), rt, opts...)
	default:
		panic("unreachable")
	}
}

// IsCore indicates whether the represented kind is a core kind.
func (decl SomeDecl) IsCore() bool {
	_, is := decl.Properties.(CoreProperties)
	return is
}

// IsCustom indicates whether the represented kind is a custom kind.
func (decl SomeDecl) IsCustom() bool {
	_, is := decl.Properties.(CustomProperties)
	return is
}

// IsComposable indicates whether the represented kind is a composable kind.
func (decl SomeDecl) IsComposable() bool {
	_, is := decl.Properties.(ComposableProperties)
	return is
}

// Decl represents a single kind declaration, having been loaded
// and validated by a func such as [LoadCoreKind].
//
// Its type parameter indicates the category of kind.
type Decl[T KindProperties] struct {
	// V is the cue.Value containing the entire Kind declaration.
	V cue.Value
	// Properties contains the kind's declared properties.
	Properties T
}

// Some converts the typed Decl to the equivalent typeless SomeDecl.
func (decl Decl[T]) Some() SomeDecl {
	return SomeDecl{
		V:          decl.V,
		Properties: any(decl.Properties).(SomeKindProperties),
	}
}

// LoadCoreKind loads and validates a core kind declaration of the kind category
// indicated by the type parameter. On success, it returns a [Decl] which
// contains the entire contents of the kind declaration.
//
// declpath is the path to the directory containing the core kind declaration,
// relative to the grafana/grafana root. For example, dashboards are in
// "kinds/dashboard".
//
// The .cue file bytes containing the core kind declaration will be retrieved
// from the central embedded FS, [grafana.CueSchemaFS]. If desired (e.g. for
// testing), an optional fs.FS may be provided via the overlay parameter, which
// will be merged over [grafana.CueSchemaFS]. But in typical circumstances,
// overlay can and should be nil.
//
// This is a low-level function, primarily intended for use in code generation.
// For representations of core kinds that are useful in Go programs at runtime,
// see ["github.com/grafana/grafana/pkg/registry/corekind"].
func LoadCoreKind(declpath string, ctx *cue.Context, overlay fs.FS) (Decl[CoreProperties], error) {
	none := Decl[CoreProperties]{}
	vk, err := cuectx.BuildGrafanaInstance(ctx, declpath, "kind", overlay)
	if err != nil {
		return none, err
	}

	props, err := ToKindProps[CoreProperties](vk)
	if err != nil {
		return none, err
	}

	return Decl[CoreProperties]{
		V:          vk,
		Properties: props,
	}, nil
}
