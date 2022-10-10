package kind

import (
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema"
	tload "github.com/grafana/thema/load"
)

// Embed for all framework-related CUE files in this directory
//
//go:embed *.cue
var cueFS embed.FS

var defaultFramework cue.Value

func init() {
	var err error
	defaultFramework, err = doLoadFrameworkCUE(cuectx.GrafanaCUEContext())
	if err != nil {
		panic(err)
	}
}

var prefix = filepath.Join("/pkg", "framework", "entity")

//nolint:nakedret
func doLoadFrameworkCUE(ctx *cue.Context) (v cue.Value, err error) {
	m := make(fstest.MapFS)

	err = fs.WalkDir(cueFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		b, err := fs.ReadFile(cueFS, path)
		if err != nil {
			return err
		}
		m[path] = &fstest.MapFile{Data: b}
		return nil
	})
	if err != nil {
		return
	}

	over := make(map[string]load.Source)

	absolutePath := prefix
	if !filepath.IsAbs(absolutePath) {
		absolutePath, err = filepath.Abs(absolutePath)
		if err != nil {
			return
		}
	}

	err = tload.ToOverlay(absolutePath, m, over)
	if err != nil {
		return
	}

	bi := load.Instances(nil, &load.Config{
		Dir:     absolutePath,
		Package: "kind",
		Overlay: over,
	})
	v = ctx.BuildInstance(bi[0])

	if v.Err() != nil {
		return cue.Value{}, fmt.Errorf("coremodel framework loaded cue.Value has err: %w", v.Err())
	}

	return
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
	default:
		// unreachable so long as all the possibilities in KindMetas have switch branches
		panic("unreachable")
	}

	item := v.Unify(kdef)
	// TODO recall and comment on the difference between Err and Validate
	if item.Err() != nil {
		return *meta, ewrap(item.Err(), ErrValueNotAKind)
	}
	if err := item.Validate(); err != nil {
		return *meta, ewrap(item.Err(), ErrValueNotAKind)
	}
	if err := item.Decode(meta); err != nil {
		// Should only be reachable if CUE and Go framework types have diverged
		panic(errors.Details(err, nil))
	}

	return *meta, nil
}

// ParsedKindDefinition is the result of a successful call to ParseKindFS. It
// represents a kind definition in partially-processed form, amenable for
// further processing into
type ParsedKindDefinition struct {
	// V is the cue.Value corresponding to the entire Kind declaration.
	V cue.Value
	// Meta configuration for the kind.
	Meta SomeKindMeta
}

// BindKindLineage binds the lineage for the parsed kind. nil, nil is returned for raw kinds.
//
// For kinds with a corresponding Go type, it left to the caller to associate that Go type
// with the returned lineage by calling [thema.BindType].
func (pk *ParsedKindDefinition) BindKindLineage(rt *thema.Runtime, opts ...thema.BindOption) (thema.Lineage, error) {
	switch pk.Meta.(type) {
	case RawMeta:
		return nil, nil
	case CoreStructuredMeta, CustomStructuredMeta:
		return thema.BindLineage(pk.V.LookupPath(cue.MakePath(cue.Str("lineage"))), rt, opts...)
	default:
		panic("unreachable")
	}
}

// ParseKindFS takes an fs.FS and validates that it represents one
// of the valid kind variants. On success, it returns a representation
// of the entire kind definition contained in the provided kfs.
func ParseKindFS(kfs fs.FS, rt *thema.Runtime) (*ParsedKindDefinition, error) {
	panic("TODO")
}
