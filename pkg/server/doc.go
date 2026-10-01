// Server defines the main entrypoints to Grafana and the Grafana CLI, as well
// as test environments. OSS and Enterprise-specific build tags are used in this
// package to control wire dependencies for each build.
package server

// Notes about wiresets:
//
// bootstrap/wire contains edition-neutral core provider sets (Basic, Server, CLI,
// Test) and OSS injectors. Grafana Enterprise will import bootstrap/wire for the
// shared graph in later migration steps.
//
// wireext contains OSS edition bindings only. It is not imported by Enterprise.
//
// wire.go contains Enterprise Wire injectors and compatibility aliases for the
// overlaid wireexts_enterprise.go extension sets.
//
// wireexts_enterprise.go contains wiresets used only by Enterprise builds. This
// file is located in the grafana-enterprise repo and synced via enterprise-to-oss.
//
// NOTE WELL: Extension sets can import sets from bootstrap/wire, but bootstrap/wire
// cannot include edition-specific wiresets.
//
// We use go build tags during build to configure which wiresets are used in a
// given build. We do not commit generated wire sets (wire_gen.go) into the
// repo.
