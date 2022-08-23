package coremodel

import (
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/thema/kernel"
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

var prefix = filepath.Join("/pkg", "framework", "coremodel")

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
	err = tload.ToOverlay(prefix, m, over)
	if err != nil {
		return
	}

	bi := load.Instances(nil, &load.Config{
		Dir:     prefix,
		Package: "coremodel",
		Overlay: over,
	})
	v = ctx.BuildInstance(bi[0])

	if v.Err() != nil {
		return cue.Value{}, fmt.Errorf("coremodel framework loaded cue.Value has err: %w", v.Err())
	}

	return
}

// CUEFramework returns a cue.Value representing all the coremodel framework
// raw CUE files.
//
// For low-level use in constructing other types and APIs, while still letting
// us declare all the frameworky CUE bits in a single package. Other types and
// subpackages make the constructs in this value easy to use.
//
// The returned cue.Value is built from Grafana's standard central CUE context,
// ["github.com/grafana/grafana/pkg/cuectx".ProvideCueContext].
func CUEFramework() cue.Value {
	return defaultFramework
}

// CUEFrameworkWithContext is the same as CUEFramework, but allows control over
// the cue.Context that's used.
//
// Prefer CUEFramework unless you understand cue.Context, and absolutely need
// this control.
func CUEFrameworkWithContext(ctx *cue.Context) cue.Value {
	// Error guaranteed to be nil here because erroring would have caused init() to panic
	v, _ := doLoadFrameworkCUE(ctx) // nolint:errcheck
	return v
}

// Mux takes a coremodel and returns a Thema version muxer that, given a byte
// slice containing any version of schema for that coremodel, will translate it
// to the Interface.CurrentSchema() version, and optionally decode it onto the
// Interface.GoType().
//
// By default, JSON decoding will be used, and the filename given to any input
// bytes (shown in errors, which may be user-facing) will be
// "<name>.<encoding>", e.g. dashboard.json.
func Mux(cm Interface, opts ...MuxOption) kernel.InputKernel {
	c := &muxConfig{}
	for _, opt := range opts {
		opt(c)
	}

	cfg := kernel.InputKernelConfig{
		Typ:     cm.GoType(),
		Lineage: cm.Lineage(),
		To:      cm.CurrentSchema().Version(),
	}

	switch c.decodetyp {
	case "", "json": // json by default
		if c.filename == "" {
			c.filename = fmt.Sprintf("%s.json", cm.Lineage().Name())
		}
		cfg.Loader = kernel.NewJSONDecoder(c.filename)
	case "yaml":
		if c.filename == "" {
			c.filename = fmt.Sprintf("%s.yaml", cm.Lineage().Name())
		}
		cfg.Loader = kernel.NewYAMLDecoder(c.filename)
	default:
		panic("")
	}

	mux, err := kernel.NewInputKernel(cfg)
	if err != nil {
		// Barring a fundamental bug in Thema's schema->Go type assignability checker or
		// a direct attempt by a Grafana dev to get around the invariants of coremodel codegen,
		// this should be unreachable. (And even the latter case should be caught elsewhere
		// by tests).
		panic(err)
	}
	return mux
}

// A MuxOption defines options that may be specified only at initial
// construction of a Lineage via BindLineage.
type MuxOption muxOption

// Internal representation of MuxOption.
type muxOption func(c *muxConfig)

type muxConfig struct {
	filename  string
	decodetyp string
}

// YAML indicates that the resulting Mux should look for YAML in input bytes,
// rather than the default JSON.
func YAML() MuxOption {
	return func(c *muxConfig) {
		c.decodetyp = "yaml"
	}
}

// Filename specifies the filename that is given to input bytes passing through
// the mux.
//
// The filename has no impact on mux behavior, but is used in user-facing error
// output, such as schema validation failures. Thus, it is recommended to pick a
// name that will make sense in the context a user is expected to see the error.
func Filename(name string) MuxOption {
	return func(c *muxConfig) {
		c.filename = name
	}
}
