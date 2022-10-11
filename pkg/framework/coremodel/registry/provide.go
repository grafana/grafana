package registry

import (
	"sync"

	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/thema"
)

// CoremodelSet contains all of the wire-style providers related to coremodels.
var CoremodelSet = wire.NewSet(
	NewBase,
)

// NewBase provides a registry of all coremodels, without any composition of
// plugin-defined schemas.
//
// The returned registry will use Grafana's singleton [thema.Runtime],
// returned from [cuectx.GrafanaThemaRuntime].
func NewBase() *Base {
	return provideBase(nil)
}

// NewBaseWithRuntime is the same as NewBase, but allows control over the
// [thema.Runtime] used to initialize the underlying coremodels.
//
// Prefer NewBase unless you absolutely need this control.
//
// TODO it's OK to export this if it's ever actually needed
func NewBaseWithRuntime(rt *thema.Runtime) *Base {
	return provideBase(rt)
}

var (
	baseOnce    sync.Once
	defaultBase *Base
)

func provideBase(rt *thema.Runtime) *Base {
	if rt == nil {
		baseOnce.Do(func() {
			defaultBase = doProvideBase(cuectx.GrafanaThemaRuntime())
		})
		return defaultBase
	}

	return doProvideBase(rt)
}

// All returns a slice of all registered coremodels.
//
// Prefer this method when operating generically across all coremodels.
//
// The returned slice is sorted lexicographically by coremodel name. It should
// not be modified.
func (b *Base) All() []coremodel.Interface {
	return b.all
}
