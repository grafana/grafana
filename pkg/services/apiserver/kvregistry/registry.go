// Package kvregistry tracks which group/resource pairs have the kv subresource
// mounted. It is a singleton populated at server startup by InjectForManifest
// (pkg/services/apiserver/kvsubresource) and read at request time by the
// authorizerForAPI pass-through (pkg/services/apiserver/auth/authorizer).
//
// Using a package-level registry avoids threading a registration callback
// through the function chains leading to InjectForManifest while keeping the
// authorizer free of a direct dependency on the kvsubresource package.
package kvregistry

import "sync"

// mounted stores "group/resource" entries for resources that have the kv
// subresource injected. A sync.Map is used because writes happen at startup
// (from InjectForManifest) and reads happen on every kv request. Entries are
// only added, never removed: the feature flag gates the entire injection, so
// toggling off requires a restart which reinitializes the map.
var mounted sync.Map

// Register marks the given group/resource pair as having the kv subresource
// mounted. Called by InjectForManifest after each successful connector injection.
func Register(group, resource string) {
	mounted.Store(group+"/"+resource, struct{}{})
}

// HasKV reports whether the given group/resource pair has the kv subresource
// mounted. Used by the authorizerForAPI pass-through to gate the allow decision.
func HasKV(group, resource string) bool {
	_, ok := mounted.Load(group + "/" + resource)
	return ok
}
