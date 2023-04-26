package corelist

import (
	"sync"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
)

var coreTrees []pfs.ParsedPlugin
var coreOnce sync.Once

// New returns a pfs.PluginList containing the plugin trees for all core plugins
// in the current version of Grafana.
//
// Go code within the grafana codebase should only ever call this with nil.
func New(rt *thema.Runtime) []pfs.ParsedPlugin {
	var pl []pfs.ParsedPlugin
	if rt == nil {
		coreOnce.Do(func() {
			coreTrees = corePlugins(cuectx.GrafanaThemaRuntime())
		})
		pl = make([]pfs.ParsedPlugin, len(coreTrees))
		copy(pl, coreTrees)
	} else {
		return corePlugins(rt)
	}
	return pl
}
