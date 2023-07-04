package corelist

import (
	"sync"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
)

var coreTrees []kindsys.Provider
var coreOnce sync.Once

// New returns a pfs.PluginList containing the plugin trees for all core plugins
// in the current version of Grafana.
//
// Go code within the grafana codebase should only ever call this with nil.
func New(rt *thema.Runtime) []kindsys.Provider {
	var pl []kindsys.Provider
	if rt == nil {
		coreOnce.Do(func() {
			coreTrees = corePlugins(cuectx.GrafanaThemaRuntime())
		})
		pl = make([]kindsys.Provider, len(coreTrees))
		copy(pl, coreTrees)
	} else {
		return corePlugins(rt)
	}
	return pl
}
