package kindreg

import (
	"sync"

	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/framework/kind"
	"github.com/grafana/thema"
)

// KindSet contains all of the wire-style providers related to kinds.
var KindSet = wire.NewSet(
	NewBase,
)

var (
	baseOnce    sync.Once
	defaultBase *Base
)

// NewBase provides a registry of all core raw and structured kinds, without any
// composition of slot kinds.
//
// All calling code within grafana/grafana is expected to use Grafana's
// singleton [thema.Runtime], returned from [cuectx.GrafanaThemaRuntime]. If nil
// is passed, the singleton will be used.
func NewBase(rt *thema.Runtime) *Base {
	allrt := cuectx.GrafanaThemaRuntime()
	if rt == nil || rt == allrt {
		baseOnce.Do(func() {
			defaultBase = doNewBase(allrt)
		})
		return defaultBase
	}

	return doNewBase(rt)
}

// All returns a slice of the [kind.Interface] instances corresponding to all
// core raw and structured kinds.
//
// The returned slice is sorted lexicographically by kind name.
func (b *Base) All() []kind.Interface {
	ret := make([]kind.Interface, len(b.all))
	copy(ret, b.all)
	return ret
}

// AllRaw returns a slice of the [kind.Raw] instances for all raw kinds.
//
// The returned slice is sorted lexicographically by kind name.
func (b *Base) AllRaw() []kind.Raw {
	ret := make([]kind.Raw, 0, b.numRaw)
	for _, k := range b.all {
		if rk, is := k.(kind.Raw); is {
			ret = append(ret, rk)
		}
	}

	return ret
}

// AllStructured returns a slice of the [kind.Structured] instances for
// all core structured kinds.
//
// The returned slice is sorted lexicographically by kind name.
func (b *Base) AllStructured() []kind.Structured {
	ret := make([]kind.Structured, 0, b.numStructured)
	for _, k := range b.all {
		if rk, is := k.(kind.Structured); is {
			ret = append(ret, rk)
		}
	}
	return ret
}
