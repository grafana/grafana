// Package managerkinds holds the manager kinds added on top of the built-in ones.
// It is internal so that identity.RegisterManagerKind, which also records who may
// assign a kind, stays the only way to add one.
package managerkinds

var registered = map[string]struct{}{}

// Add records a kind. It is not safe for concurrent use; call it during init.
func Add(kind string) {
	registered[kind] = struct{}{}
}

// Has reports whether a kind was added.
func Has(kind string) bool {
	_, ok := registered[kind]
	return ok
}

// Remove forgets a kind, so tests can clean up after themselves.
func Remove(kind string) {
	delete(registered, kind)
}
