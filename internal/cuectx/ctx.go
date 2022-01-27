// Package cuectx provides a single, central CUE context (runtime) and Thema
// library that can be used uniformly across Grafana.

package cuectx

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/thema"
)

var ctx *cue.Context = cuecontext.New()
var lib thema.Library = thema.NewLibrary(ctx)

// ProvideCUEContext is a wire service provider of a central cue.Context.
func ProvideCUEContext() *cue.Context {
	return ctx
}

// ProvideThemaLibrary is a wire service provider of a central thema.Library.
func ProvideThemaLibrary() thema.Library {
	return lib
}
