package slot

import (
	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/framework/coremodel"
)

type Slot interface {
	Name() string
	MetaSchema() cue.Value
}

type slot struct {
	name    string
	raw     cue.Value
	plugins []string
}

func (s slot) Name() string {
	return s.name
}

func (s slot) MetaSchema() cue.Value {
	return s.raw
}

type Registry struct {
	fw    cue.Value
	slots []Slot
}

func NewRegistry() *Registry {
	r := &Registry{
		fw: coremodel.CUEFramework(),
	}
	// Ignore err, can only happen if we change structure of fw files, and all we'd
	// do is panic and that's what the next line will do anyway. Same for similar later
	// calls in this func
	iter, _ := r.fw.LookupPath(cue.ParsePath("pluginTypeMetaSchema")).Fields()
	plugslots := make(map[string][]string)
	for iter.Next() {
		plugin := iter.Selector().String()
		iiter, _ := iter.Value().Fields()
		for iiter.Next() {
			plugslots[plugin] = append(plugslots[plugin], iiter.Selector().String())
		}
	}

	iter, _ = r.fw.LookupPath(cue.ParsePath("slots")).Fields()
	for iter.Next() {
		n := iter.Selector().String()
		sl := slot{
			name:    n,
			raw:     iter.Value(),
			plugins: plugslots[n],
		}
		r.slots = append(r.slots, sl)
	}

	return r
}

func (r *Registry) Slots() []Slot {
	sl := make([]Slot, 0, len(r.slots))
	copy(sl, r.slots)
	return sl
}

// Actions
// - List slots
// - get name of slot
// - get path of slot
// - get slot metaschema
// - see which plugins are associated with which slots
