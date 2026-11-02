// Package wire holds the core Wire provider sets that both OSS and Enterprise
// build the Grafana server from (sets.go: Basic, Server, CLI, Test), plus the
// OSS-only code that turns those sets into a running server (inject.go,
// wire_gen.go, register_oss.go).
//
// Grafana Enterprise imports this package only for the sets, and combines them
// with its own bindings. The OSS-only files here are behind the `oss` /
// `!enterprise && !pro` build tags, so Enterprise builds skip them. OSS bindings
// live in pkg/server/wireext.
//
// Why the OSS server.Initialize is set up in an init() instead of just being called:
//
// The sets in sets.go call server.New and server.NewRunner, so this package
// imports pkg/server. That means pkg/server can't import this package back (Go
// doesn't allow two packages to import each other). So rather than pkg/server
// calling the Initialize generated here, this package hands its Initialize
// functions to pkg/server when it loads:
//
//	register_oss.go init() -> server.RegisterInitializers(Initialize, ...)
//
// pkg/server stores those functions and its own server.Initialize just calls
// whichever one it was given (see initialize_oss.go). That only works if the
// program actually loads this package, which is why main, grafana-cli, and
// testinfra import it with a blank identifier (_) — the import runs the init()
// above. Without it those functions are never registered.
//
// Enterprise doesn't do any of this: its generated enterprise_wire_gen.go
// defines server.Initialize directly, and it keeps its own copy of the sets in
// pkg/server/wire_core.go. This init() setup and that copied file both exist to
// work around the same import limitation; there's a plan to remove them by
// moving server.New and server.NewRunner into their own package. See
// docs/design/ge-standalone/unify-wire-core-sets.md.
package wire
