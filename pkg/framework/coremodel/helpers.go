package coremodel

import (
	"embed"
	"fmt"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	tload "github.com/grafana/thema/load"

	"github.com/grafana/grafana/pkg/cuectx"
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
