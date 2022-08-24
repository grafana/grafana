package registry

import (
	"sync"

	"github.com/grafana/grafana/pkg/cuectx"
	"github.com/grafana/grafana/pkg/plugins/pfs"
	"github.com/grafana/thema"
)

// TreeList implements PluginTreeRegistry with a simple slice of *pfs.Tree.
type TreeList []*pfs.Tree

var coreTrees TreeList
var coreOnce sync.Once

// NewCore returns a TreeList containing the plugin trees for all core plugins
// in the current version of Grafana.
//
// Code within the grafana codebase should only ever call this with nil.
func NewCore(lib *thema.Library) TreeList {
	var tl TreeList
	if lib == nil {
		coreOnce.Do(func() {
			coreTrees = coreTreeList(cuectx.ProvideThemaLibrary())
		})
		tl = make(TreeList, len(coreTrees))
		copy(tl, coreTrees)
	} else {
		return coreTreeList(*lib)
	}
	return tl
}

func init() {
	// TODO if we have performance issues with CUE bootstrapping, try uncommenting this. Note that this may have thread safety issues.
	// go NewCore(nil)
}

type PluginTreeRegistry interface {
	LineagesForSlot(string) map[string]thema.Lineage
}

// LineagesForSlot returns the set of plugin-defined lineages that implement a
// particular named Grafana slot (See ["github.com/grafana/grafana/pkg/framework/coremodel".Slot]).
func (tl TreeList) LineagesForSlot(slotname string) map[string]thema.Lineage {
	m := make(map[string]thema.Lineage)
	for _, tree := range tl {
		rootp := tree.RootPlugin()
		rid := rootp.Meta().Id

		if lin, has := rootp.SlotImplementations()[slotname]; has {
			m[rid] = lin
		}
	}

	return m
}
