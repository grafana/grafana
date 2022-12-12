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

// DeclParentPath is the path, relative to the repository root, where
// each child directory is expected to contain directories with .cue files,
// declaring one kind.
var DeclParentPath = "kinds"

// CoreStructuredDeclParentPath is the path, relative to the repository root, where
// each child directory is expected to contain .cue files declaring one
// CoreStructured kind.
var CoreStructuredDeclParentPath = filepath.Join(DeclParentPath, "structured")

// RawDeclParentPath is the path, relative to the repository root, where each child
// directory is expected to contain .cue files declaring one Raw kind.
var RawDeclParentPath = filepath.Join(DeclParentPath, "raw")

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
// make the constructs in this value easy to use.
//
// All calling code within grafana/grafana is expected to use Grafana's
// singleton [cue.Context], returned from [cuectx.GrafanaCUEContext]. If nil
// is passed, the singleton will be used.
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

// ToKindMeta takes a cue.Value expected to represent a kind of the category
// specified by the type parameter and populates the Go type from the cue.Value.
func ToKindMeta[T KindProperties](v cue.Value) (T, error) {
	props := new(T)
	if !v.Exists() {
		return *props, ErrValueNotExist
	}

	fw := CUEFramework(v.Context())
	var kdef cue.Value

	anyprops := any(*props).(SomeKindProperties)
	switch anyprops.(type) {
	case RawProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("Raw")))
	case CoreStructuredProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("CoreStructured")))
	case CustomStructuredProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("CustomStructured")))
	case ComposableProperties:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("Composable")))
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

// BindKindLineage binds the lineage for the kind declaration. nil, nil is returned
// for raw kinds.
//
// For kinds with a corresponding Go type, it is left to the caller to associate
// that Go type with the lineage returned from this function by a call to [thema.BindType].
func (decl *SomeDecl) BindKindLineage(rt *thema.Runtime, opts ...thema.BindOption) (thema.Lineage, error) {
	if rt == nil {
		rt = cuectx.GrafanaThemaRuntime()
	}
	switch decl.Properties.(type) {
	case RawProperties:
		return nil, nil
	case CoreStructuredProperties, CustomStructuredProperties, ComposableProperties:
		return thema.BindLineage(decl.V.LookupPath(cue.MakePath(cue.Str("lineage"))), rt, opts...)
	default:
		panic("unreachable")
	}
}

// IsRaw indicates whether the represented kind is a raw kind.
func (decl *SomeDecl) IsRaw() bool {
	_, is := decl.Properties.(RawProperties)
	return is
}

// IsCoreStructured indicates whether the represented kind is a core structured kind.
func (decl *SomeDecl) IsCoreStructured() bool {
	_, is := decl.Properties.(CoreStructuredProperties)
	return is
}

// IsCustomStructured indicates whether the represented kind is a custom structured kind.
func (decl *SomeDecl) IsCustomStructured() bool {
	_, is := decl.Properties.(CustomStructuredProperties)
	return is
}

// IsComposable indicates whether the represented kind is a composable kind.
func (decl *SomeDecl) IsComposable() bool {
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
func (decl *Decl[T]) Some() *SomeDecl {
	return &SomeDecl{
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
// "kinds/structured/dashboard".
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
func LoadCoreKind[T RawProperties | CoreStructuredProperties](declpath string, ctx *cue.Context, overlay fs.FS) (*Decl[T], error) {
	vk, err := cuectx.BuildGrafanaInstance(ctx, declpath, "kind", overlay)
	if err != nil {
		return nil, err
	}
	decl := &Decl[T]{
		V: vk,
	}
	decl.Properties, err = ToKindMeta[T](vk)
	if err != nil {
		return nil, err
	}
	return decl, nil
}
