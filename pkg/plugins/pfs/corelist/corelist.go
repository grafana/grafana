package corelist

import (
	"sync"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
)

var coreTrees pfs.TreeList
var coreOnce sync.Once

// New returns a pfs.TreeList containing the plugin trees for all core plugins
// in the current version of Grafana.
//
// Go code within the grafana codebase should only ever call this with nil.
func New(rt *thema.Runtime) pfs.TreeList {
	var tl pfs.TreeList
	if rt == nil {
		coreOnce.Do(func() {
			coreTrees = coreTreeList(cuectx.GrafanaThemaRuntime())
		})
		tl = make(pfs.TreeList, len(coreTrees))
		copy(tl, coreTrees)
	} else {
		return coreTreeList(rt)
	}
	return tl
}
