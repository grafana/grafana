package kindsysreport

import (
	"cuelang.org/go/cue"
)

type AttributeWalker struct {
	seen  map[cue.Value]bool
	count map[string]int
}

func (w *AttributeWalker) Count(sch cue.Value, attrs ...string) map[string]int {
	w.seen = make(map[cue.Value]bool)
	w.count = make(map[string]int)

	for _, attr := range attrs {
		w.count[attr] = 0
	}

	w.walk(cue.MakePath(), sch)
	return w.count
}

func (w *AttributeWalker) walk(p cue.Path, v cue.Value) {
	if w.seen[v] {
		return
	}

	w.seen[v] = true

	for attr := range w.count {
		if found := v.Attribute(attr); found.Err() == nil {
			w.count[attr]++
		}
	}

	// nolint: exhaustive
	switch v.Kind() {
	case cue.StructKind:
		// If current cue.Value is a reference to another
		// definition, we don't want to traverse its fields
		// individually, because we'll do so for the actual def.
		if v != cue.Dereference(v) {
			return
		}

		iter, err := v.Fields(cue.All())
		if err != nil {
			panic(err)
		}

		for iter.Next() {
			w.walk(appendPath(p, iter.Selector()), iter.Value())
		}
		if lv := v.LookupPath(cue.MakePath(cue.AnyString)); lv.Exists() {
			w.walk(appendPath(p, cue.AnyString), lv)
		}
	case cue.ListKind:
		list, err := v.List()
		if err != nil {
			panic(err)
		}
		for i := 0; list.Next(); i++ {
			w.walk(appendPath(p, cue.Index(i)), list.Value())
		}
		if lv := v.LookupPath(cue.MakePath(cue.AnyIndex)); lv.Exists() {
			w.walk(appendPath(p, cue.AnyString), lv)
		}
	}
}

func appendPath(p cue.Path, sel cue.Selector) cue.Path {
	return cue.MakePath(append(p.Selectors(), sel)...)
}
