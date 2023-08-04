package corekind

import (
	"sort"
	"sync"

	"github.com/grafana/kindsys"
	"github.com/grafana/thema"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
)

var (
	distOnce    sync.Once
	defaultDist *Dist
)

// Dist contains all of the core kinds in the [Base] registry, composed with
// all of the composable kinds defined by plugins within grafana/grafana.
type Dist struct {
	all []kindsys.Core
}

// NewDist provides a registry of all core kinds, with all composable kinds
// provided by Grafana core injected.
//
// All calling code within grafana/grafana is expected to use Grafana's
// singleton [thema.Runtime], returned from [cuectx.GrafanaThemaRuntime]. If nil
// is passed, the singleton will be used.
func NewDist(rt *thema.Runtime) *Dist {
	allrt := cuectx.GrafanaThemaRuntime()
	if rt == nil || rt == allrt {
		distOnce.Do(func() {
			defaultDist = buildDistRegistry(allrt, NewBase(allrt))
		})
		return defaultDist
	}

	return defaultDist
}

// All is the same as [Base.All], but with all composable kinds composed.
func (b *Dist) All() []kindsys.Core {
	ret := make([]kindsys.Core, len(b.all))
	copy(ret, b.all)
	return ret
}

// ByName looks up a kind in the registry by name. If no kind exists for the
// given name, nil is returned.
func (b *Dist) ByName(name string) kindsys.Core {
	i := sort.Search(len(b.all), func(i int) bool {
		return b.all[i].Name() >= name
	})

	if i < len(b.all) && b.all[i].Name() == name {
		return b.all[i]
	}
	return nil
}

func buildDistRegistry(rt *thema.Runtime, reg *Base) *Dist {
	dr := &Dist{
		all: make([]kindsys.Core, 0, len(reg.All())),
	}

	coreplugins := corelist.New(rt)
	for _, corek := range reg.All() {
		for _, slot := range corek.Props().(kindsys.CoreProperties).Slots {
			var toCompose []kindsys.Composable
			for _, pp := range coreplugins {
				for _, compok := range pp.ComposableKinds {
					if compok.Implements().Name() == slot.SchemaInterface {
						toCompose = append(toCompose, compok)
					}
				}
			}
			var err error
			corek, err = corek.Compose(slot, toCompose...)
			if err != nil {
				// should be unreachable, panic for now, err once this is separated out
				panic(err)
			}
		}
		dr.all = append(dr.all, corek)
	}

	return dr
}
