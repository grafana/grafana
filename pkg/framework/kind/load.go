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
	tload "github.com/grafana/thema/load"
)

// Embed for all framework-related CUE files in this directory
//
//go:embed *.cue
var cueFS embed.FS

var defaultFramework cue.Value

func init() {
	var err error
	defaultFramework, err = doLoadFrameworkCUE(cuectx.ProvideCUEContext())
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
// The returned cue.Value is built from Grafana's standard central CUE context,
// ["github.com/grafana/grafana/pkg/cuectx".ProvideCueContext].
func CUEFramework() cue.Value {
	return defaultFramework
}

// cueFrameworkWithContext is the same as CUEFramework, but allows control over
// the cue.Context that's used.
//
// Prefer CUEFramework unless you understand cue.Context, and absolutely need
// this control.
// NOTE export this if there's ever an actual need for it
func cueFrameworkWithContext(ctx *cue.Context) cue.Value {
	// Error guaranteed to be nil here because erroring would have caused init() to panic
	if ctx == cuectx.ProvideCUEContext() {
		return defaultFramework
	}
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

	fw := cueFrameworkWithContext(v.Context())
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
		// return mo.Err[T](ewrap(item.Err(), ErrValueNotAKind))
		return *meta, ewrap(item.Err(), ErrValueNotAKind)
	}
	if err := item.Validate(); err != nil {
		// return mo.Err[T](ewrap(err, ErrValueNotAKind))
		return *meta, ewrap(item.Err(), ErrValueNotAKind)
	}
	if err := item.Decode(meta); err != nil {
		// Should only be reachable if CUE and Go framework types have diverged
		panic(errors.Details(err, nil))
	}

	return *meta, nil
}

func LoadKindValue(cueFS fs.FS) (cue.Value, error) {
	panic("TODO")
}
