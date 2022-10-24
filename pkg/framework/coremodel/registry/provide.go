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

var (
	baseOnce    sync.Once
	defaultBase *Base
)

// NewBase provides a registry of all coremodels, without any composition of
// plugin-defined schemas.
//
// All calling code within grafana/grafana is expected to use Grafana's
// singleton [thema.Runtime], returned from [cuectx.GrafanaThemaRuntime]. If nil
// is passed, the singleton will be used.
func NewBase(rt *thema.Runtime) *Base {
	allrt := cuectx.GrafanaThemaRuntime()
	if rt == nil || rt == allrt {
		baseOnce.Do(func() {
			defaultBase = doProvideBase(allrt)
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
