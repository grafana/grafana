// Package wire holds the core Wire provider sets that both OSS and Enterprise
// build the Grafana server from (sets.go: Basic, Server, CLI, Test), plus each
// edition's injectors and generated graph for the full server:
//
//	OSS:        inject.go, oss_ext.go, wire_gen.go            (oss / !enterprise && !pro)
//	Enterprise: inject_enterprise.go, wireexts_enterprise.go, (enterprise || pro)
//	            enterprise_wire_gen.go
//
// Both editions therefore build Initialize, InitializeForTest, InitializeForCLI
// and InitializeAPIServerFactory from the same sets — callers use
// bootstrapwire.Initialize regardless of edition. OSS bindings live in
// pkg/server/wireext; the enterprise bindings file is overlaid from the
// grafana-enterprise repository.
//
// The sets here call server.New and server.NewRunner, so this package imports
// pkg/server and pkg/server cannot import it back. That is why the module
// server's injectors (InitializeModuleServer, InitializeSearchSupport,
// InitializeDashboardStats, InitializeForCLITarget) live in pkg/server instead:
// ModuleServer calls the search-support ones lazily while starting a module, so
// they have to be reachable from within pkg/server. Their provider sets are
// self-contained and do not use the core sets here, so nothing is duplicated.
package wire
