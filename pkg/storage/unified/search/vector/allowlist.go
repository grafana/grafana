package vector

import "strings"

// CollectionAllowlist is config-defined policy for which collections may be
// served through the vector APIs. The catalog maps names to partitions; this
// decides whether a resolved collection is addressable at all.
type CollectionAllowlist struct {
	internal map[string]struct{}
	external map[string]struct{}
}

// NewCollectionAllowlist builds an allowlist from "group/resource" entries.
// Surrounding whitespace is ignored and empty entries are dropped; the zero
// value (and empty lists) allow nothing.
func NewCollectionAllowlist(internal, external []string) CollectionAllowlist {
	return CollectionAllowlist{
		internal: allowlistSet(internal),
		external: allowlistSet(external),
	}
}

func allowlistSet(entries []string) map[string]struct{} {
	set := make(map[string]struct{}, len(entries))
	for _, e := range entries {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		set[e] = struct{}{}
	}
	return set
}

// Allows reports whether the collection may be served. Internal and external
// collections are gated by separate lists.
func (a CollectionAllowlist) Allows(c Collection) bool {
	key := c.Group + "/" + c.Resource
	if c.IsExternal {
		_, ok := a.external[key]
		return ok
	}
	_, ok := a.internal[key]
	return ok
}
