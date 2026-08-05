// Package wire exposes the edition-neutral core Wire provider sets (sets.go:
// Basic, Server, CLI, Test) together with the OSS dependency-injection
// entrypoints and generated graph (inject.go, wire_gen.go, register_oss.go).
//
// Grafana Enterprise imports this package only for the shared provider sets when
// it composes its own Wire graph. It never links the OSS-specific files here:
// those carry the `oss` or `!enterprise && !pro` build tags, so an enterprise
// build excludes them. OSS edition bindings live in pkg/server/wireext.
//
// # Why the OSS injectors register themselves into pkg/server
//
// The core sets reference constructors that live in pkg/server (server.New,
// server.NewRunner), so this package imports pkg/server. That makes the reverse
// edge impossible: pkg/server cannot import this package to call the OSS
// Initialize directly — it would be an import cycle.
//
// To still expose server.Initialize (and friends) as pkg/server symbols, the OSS
// injectors are pushed into pkg/server at init time rather than imported:
//
//	wire.init()  (register_oss.go)
//	  → server.RegisterInitializers(Initialize, …)   // stores funcs in pkg/server vars
//	server.Initialize(…)  (initialize_oss.go)        // thin shim over those vars
//
// This is why main / grafana-cli / testinfra blank-import this package: the blank
// import runs register_oss.go's init() so the pkg/server dispatch vars are
// populated (otherwise they are nil).
//
// Enterprise does not use this indirection — enterprise_wire_gen.go defines
// server.Initialize directly in pkg/server and keeps its own copy of the core
// sets in pkg/server/wire_core.go. Both this register/dispatch shim and that
// duplicate are workarounds for the same pkg/server import cycle. See
// docs/design/ge-standalone/unify-wire-core-sets.md for the planned cleanup that
// relocates the constructors and removes both.
package wire
