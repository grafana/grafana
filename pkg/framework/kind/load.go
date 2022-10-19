package kind

import (
	"fmt"
	"io/fs"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"github.com/grafana/grafana"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	tload "github.com/grafana/thema/load"
)

var defaultFramework cue.Value

func init() {
	var err error
	defaultFramework, err = doLoadFrameworkCUE(cuectx.GrafanaCUEContext())
	if err != nil {
		panic(err)
	}
}

var prefix = filepath.Join("/pkg", "framework", "kind")

func doLoadFrameworkCUE(ctx *cue.Context) (cue.Value, error) {
	var v cue.Value
	var err error

	absolutePath := prefix
	if !filepath.IsAbs(absolutePath) {
		absolutePath, err = filepath.Abs(absolutePath)
		if err != nil {
			return v, err
		}
	}

	bi, err := tload.InstancesWithThema(grafana.CueSchemaFS, absolutePath)
	if err != nil {
		return v, err
	}
	v = ctx.BuildInstance(bi)

	if err = v.Validate(cue.Concrete(false), cue.All()); err != nil {
		return cue.Value{}, fmt.Errorf("coremodel framework loaded cue.Value has err: %w", err)
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
		return defaultFramework
	}
	// Error guaranteed to be nil here because erroring would have caused init() to panic
	v, _ := doLoadFrameworkCUE(ctx) // nolint:errcheck
	return v
}

// BindSomeKind takes a cue.Value expected to represent one of Grafana's kind
// variants, and attempts to extract its metadata into the relevant typed struct.
func BindSomeKind(v cue.Value) (SomeKindMeta, error) {
	if !v.Exists() {
		return nil, ErrValueNotExist
	}

	if meta, err := BindKind[RawMeta](v); err == nil {
		return meta, nil
		// return metaToSome(meta), nil
	}
	if meta, err := BindKind[CoreStructuredMeta](v); err == nil {
		return meta, nil
		// return metaToSome(meta), nil
	}
	if meta, err := BindKind[CustomStructuredMeta](v); err == nil {
		return meta, nil
		// return metaToSome(meta), nil
	}
	return nil, ErrValueNotAKind
}

func BindKind[T KindMetas](v cue.Value) (T, error) {
	meta := new(T)
	if !v.Exists() {
		return *meta, ErrValueNotExist
	}

	fw := CUEFramework(v.Context())
	var kdef cue.Value

	anymeta := any(*meta).(SomeKindMeta)
	switch anymeta.(type) {
	case RawMeta:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("Raw")))
	case CoreStructuredMeta:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("CoreStructured")))
	case CustomStructuredMeta:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("CustomStructured")))
	case SlotImplMeta:
		kdef = fw.LookupPath(cue.MakePath(cue.Def("Slot")))
	default:
		// unreachable so long as all the possibilities in KindMetas have switch branches
		panic("unreachable")
	}

	item := v.Unify(kdef)
	if err := item.Validate(cue.Concrete(false), cue.All()); err != nil {
		return *meta, ewrap(item.Err(), ErrValueNotAKind)
	}
	if err := item.Decode(meta); err != nil {
		// Should only be reachable if CUE and Go framework types have diverged
		panic(errors.Details(err, nil))
	}

	return *meta, nil
}

// Parsed is the result of a successful call to ParseAnyKindFS. It
// represents a kind definition in partially-processed form, amenable for
// further processing into a proper kind.
type Parsed struct {
	// V is the cue.Value containing the entire Kind declaration.
	V cue.Value
	// Meta contains the kind's metadata settings.
	Meta SomeKindMeta
}

type Parsed2[T RawMeta | CoreStructuredMeta | CustomStructuredMeta] struct {
	// V is the cue.Value containing the entire Kind declaration.
	V cue.Value
	// Meta contains the kind's metadata settings.
	Meta T
}

// BindKindLineage binds the lineage for the parsed kind. nil, nil is returned
// for raw kinds.
//
// For kinds with a corresponding Go type, it is left to the caller to associate
// that Go type with the lineage returned from this function by a call to [thema.BindType].
func (pk *Parsed) BindKindLineage(rt *thema.Runtime, opts ...thema.BindOption) (thema.Lineage, error) {
	switch pk.Meta.(type) {
	case RawMeta:
		return nil, nil
	case CoreStructuredMeta, CustomStructuredMeta:
		return thema.BindLineage(pk.V.LookupPath(cue.MakePath(cue.Str("lineage"))), rt, opts...)
	default:
		panic("unreachable")
	}
}

// ParseAnyKindFS takes an fs.FS and validates that it contains a valid kind
// definition from any of the kind categories. On success, it returns a
// representation of the entire kind definition contained in the provided kfs.
func ParseAnyKindFS(kfs fs.FS, path string, ctx *cue.Context) (*Parsed, error) {
	// TODO use a more genericized loader
	inst, err := tload.InstancesWithThema(kfs, path)
	if err != nil {
		return nil, err
	}

	vk := ctx.BuildInstance(inst)
	if err = vk.Validate(cue.Concrete(false), cue.All()); err != nil {
		return nil, err
	}
	pkd := &Parsed{
		V: vk,
	}
	pkd.Meta, err = BindSomeKind(vk)
	if err != nil {
		return nil, err
	}
	return pkd, nil
}

func (tpk *Parsed2[T]) ToParsed() *Parsed {
	return &Parsed{
		V:    tpk.V,
		Meta: any(tpk.Meta).(SomeKindMeta),
	}
}

// ParseCoreKindFS takes an fs.FS and validates that it contains a valid kind
// definition from the kind category indicated by the type parameter.
//
// On success, it returns a representation of the entire kind definition
// contained in the provided kfs.
func ParseCoreKindFS[T RawMeta | CoreStructuredMeta](kfs fs.FS, relpath string, ctx *cue.Context) (*Parsed2[T], error) {
	vk, err := cuectx.BuildGrafanaInstance(relpath, "kind", ctx, kfs)
	if err != nil {
		return nil, err
	}
	pkd := &Parsed2[T]{
		V: vk,
	}
	pkd.Meta, err = BindKind[T](vk)
	if err != nil {
		return nil, err
	}
	return pkd, nil
}
