// Package cuectx provides a single, central ["cuelang.org/go/cue".Context] and
// ["github.com/grafana/thema".Runtime] that can be used uniformly across
// Grafana, and related helper functions for loading Thema lineages.

package cuectx

import (
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/thema"
	"github.com/grafana/thema/vmux"
)

// CoreDefParentPath is the path, relative to the repository root, where
// each child directory is expected to contain .cue files defining one
// Core kind.
var CoreDefParentPath = "kinds"

// GoCoreKindParentPath is the path, relative to the repository root, to the directory
// containing one directory per kind, full of generated Go kind output: types and bindings.
var GoCoreKindParentPath = filepath.Join("pkg", "kinds")

// TSCoreKindParentPath is the path, relative to the repository root, to the directory that
// contains one directory per kind, full of generated TS kind output: types and default consts.
var TSCoreKindParentPath = filepath.Join("packages", "grafana-schema", "src", "raw")

var ctx = cuecontext.New()
var rt = thema.NewRuntime(ctx)

// GrafanaCUEContext returns Grafana's singleton instance of [cue.Context].
//
// All code within grafana/grafana that needs a *cue.Context should get it
// from this function, when one was not otherwise provided.
func GrafanaCUEContext() *cue.Context {
	return ctx
}

// GrafanaThemaRuntime returns Grafana's singleton instance of [thema.Runtime].
//
// All code within grafana/grafana that needs a *thema.Runtime should get it
// from this function, when one was not otherwise provided.
func GrafanaThemaRuntime() *thema.Runtime {
	return rt
}

// JSONtoCUE attempts to decode the given []byte into a cue.Value, relying on
// the central Grafana cue.Context provided in this package.
//
// The provided path argument determines the name given to the input bytes if
// later CUE operations (e.g. Thema validation) produce errors related to the
// returned cue.Value.
//
// This is a convenience function for one-off JSON decoding. It's wasteful to
// call it repeatedly. Most use cases should probably prefer making
// their own Thema/CUE decoders.
func JSONtoCUE(path string, b []byte) (cue.Value, error) {
	return vmux.NewJSONCodec(path).Decode(ctx, b)
}
