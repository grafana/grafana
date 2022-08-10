package slot

import (
	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/framework/coremodel"
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

// ForPlugin indicates whether, for the particular Slot, a slot implementation is
// accepted for that plugin type, and whether it is required to produce one.
func (s Slot) ForPlugin(plugintype string) (accepted, required bool) {
	required, accepted = s.plugins[plugintype]
	return
}

type Slots struct {
	fw    cue.Value
	slots map[string]*Slot
}

func All() *Slots {
	r := &Slots{
		fw:    coremodel.CUEFramework(),
		slots: make(map[string]*Slot),
	}

	// Ignore err, can only happen if we change structure of fw files, and all we'd
	// do is panic and that's what the next line will do anyway. Same for similar ignored
	// errors later in this func
	iter, _ := r.fw.LookupPath(cue.ParsePath("pluginTypeMetaSchema")).Fields(cue.Optional(true))
	type nameopt struct {
		name string
		req  bool
	}
	plugslots := make(map[string][]nameopt)
	for iter.Next() {
		plugin := iter.Selector().String()
		iiter, _ := iter.Value().Fields(cue.Optional(true))
		for iiter.Next() {
			plugslots[plugin] = append(plugslots[plugin], nameopt{
				name: iiter.Selector().String(),
				req:  !iiter.IsOptional(),
			})
		}
	}

	iter, _ = r.fw.LookupPath(cue.ParsePath("slots")).Fields(cue.Optional(true))
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

		r.slots[n] = &sl
	}

	return r
}

func (r *Slots) List() []*Slot {
	sl := make([]*Slot, 0, len(r.slots))
	for _, s := range r.slots {
		sl = append(sl, s)
	}
	return sl
}

func (r *Slots) ByName(slotname string) *Slot {
	return r.slots[slotname]
}
