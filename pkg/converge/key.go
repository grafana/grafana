package converge

import "strings"

// Key is an addressable location in the source: hierarchical, separated by
// "/". A key with a trailing separator denotes a container. The empty key is
// the root container.
//
// The package treats keys as opaque apart from segmentation, depth and
// ancestry. It never interprets a segment, never infers a type from an
// extension, and never rejects a character.
type Key string

const sep = "/"

// IsContainer reports whether k denotes a container.
func (k Key) IsContainer() bool { return k == "" || strings.HasSuffix(string(k), sep) }

// AsContainer returns k with a trailing separator, so that container keys
// compare equal regardless of how a caller spelled them.
func (k Key) AsContainer() Key {
	if k == "" || k.IsContainer() {
		return k
	}
	return k + sep
}

// Parent returns the container holding k, or the root key for a key at the top
// level.
func (k Key) Parent() Key {
	s := strings.TrimSuffix(string(k), sep)
	i := strings.LastIndex(s, sep)
	if i < 0 {
		return ""
	}
	return Key(s[:i+1])
}

// Depth counts the segments in k, counting the leaf. The root key has depth 0,
// "a/" and "a.json" have depth 1, "a/b/" and "a/b.json" have depth 2.
func (k Key) Depth() int {
	s := strings.Trim(string(k), sep)
	if s == "" {
		return 0
	}
	return strings.Count(s, sep) + 1
}

// Ancestors returns every container enclosing k, shallowest first, excluding
// the root and k itself.
func (k Key) Ancestors() []Key {
	var rev []Key
	for p := k.Parent(); p != ""; p = p.Parent() {
		rev = append(rev, p)
	}
	out := make([]Key, len(rev))
	for i, p := range rev {
		out[len(rev)-1-i] = p
	}
	return out
}

// eachAncestor calls fn for every container enclosing k, deepest first,
// stopping early if fn returns false. It allocates nothing, which matters
// because planning walks the ancestry of every key.
func (k Key) eachAncestor(fn func(Key) bool) {
	for p := k.Parent(); p != ""; p = p.Parent() {
		if !fn(p) {
			return
		}
	}
}

// Within reports whether k lies inside container c at any depth. A container is
// not within itself.
func (k Key) Within(c Key) bool {
	if k == c {
		return false
	}
	if c == "" {
		return k != ""
	}
	return strings.HasPrefix(string(k), string(c))
}

// DirectlyWithin reports whether c is k's immediate parent.
func (k Key) DirectlyWithin(c Key) bool { return k.Parent() == c }
