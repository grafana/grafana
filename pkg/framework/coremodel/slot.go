package coremodel

import (
	"cuelang.org/go/cue"
)

// Slot represents one of Grafana's named Thema composition slot definitions.
type Slot struct {
	name    string
	raw     cue.Value
	plugins map[string]bool
}

// Name returns the name of the Slot. The name is also used as the path at which
// a Slot lineage is defined in a plugin models.cue file.
func (s Slot) Name() string {
	return s.name
}

// MetaSchema returns the meta-schema that is the contract between coremodels
// that compose the Slot, and plugins that implement it.
func (s Slot) MetaSchema() cue.Value {
	return s.raw
}

// ForPluginType indicates whether for this Slot, plugins of the given type may
// provide a slot implementation (first return value), and for those types that
// may, whether they must produce one (second return value).
//
// Expected values here are those in the set of
// ["github.com/grafana/grafana/pkg/coremodel/pluginmeta".Type], though passing
// a string not in that set will harmlessly return {false, false}. That type is
// not used here to avoid import cycles.
//
// Note that, at least for now, plugins are not required to provide any slot
// implementations, and do so by simply not containing a models.cue file.
// Consequently, the "must" return value here is best understood as, "IF a
// plugin provides a models.cue file, it MUST contain an implementation of this
// slot."
func (s Slot) ForPluginType(plugintype string) (may, must bool) {
	must, may = s.plugins[plugintype]
	return
}

func AllSlots() map[string]*Slot {
	fw := CUEFramework()
	slots := make(map[string]*Slot)

	// Ignore err, can only happen if we change structure of fw files, and all we'd
	// do is panic and that's what the next line will do anyway. Same for similar ignored
	// errors later in this func
	iter, _ := fw.LookupPath(cue.ParsePath("pluginTypeMetaSchema")).Fields(cue.Optional(true))
	type nameopt struct {
		name string
		req  bool
	}
	plugslots := make(map[string][]nameopt)
	for iter.Next() {
		plugin := iter.Selector().String()
		iiter, _ := iter.Value().Fields(cue.Optional(true))
		for iiter.Next() {
			slotname := iiter.Selector().String()
			plugslots[slotname] = append(plugslots[slotname], nameopt{
				name: plugin,
				req:  !iiter.IsOptional(),
			})
		}
	}

	iter, _ = fw.LookupPath(cue.ParsePath("slots")).Fields(cue.Optional(true))
	for iter.Next() {
		n := iter.Selector().String()
		sl := Slot{
			name:    n,
			raw:     iter.Value(),
			plugins: make(map[string]bool),
		}

		for _, no := range plugslots[n] {
			sl.plugins[no.name] = no.req
		}

		slots[n] = &sl
	}

	return slots
}
