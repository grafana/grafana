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
// The returned registry will use the default Grafana thema.Library, defined in
// pkg/cuectx. If you need control over the thema.Library used by the coremodel
// lineages, use NewBaseWithLib instead.
func NewBase() *Base {
	return provideBase(nil)
}

// NewBaseWithLib is the same as NewBase, but allows control over the
// thema.Library used to initialize the underlying coremodels.
//
// Prefer NewBase unless you absolutely need this control.
func NewBaseWithLib(lib thema.Library) *Base {
	return provideBase(&lib)
}

var (
	baseOnce    sync.Once
	defaultBase *Base
)

func provideBase(lib *thema.Library) *Base {
	if lib == nil {
		baseOnce.Do(func() {
			defaultBase = doProvideBase(cuectx.ProvideThemaLibrary())
		})
		return defaultBase
	}

	return doProvideBase(*lib)
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
