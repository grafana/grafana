// Server defines the main entrypoints to Grafana and the Grafana CLI, as well
// as test environments. OSS and Enterprise-specific build tags are used in this
// package to control wire dependencies for each build.
package server

// Notes about wiresets:
//
// wire.go contains wire sets used by both OSS and Enterprise builds. These are
// generally base wiresets imported by the OSS- or Enterprise-specific sets.
//
// wireexts_oss.go contains the "extensions" wiresets, used only by OSS builds.
// wireexts_enterprise.go contains wiresets used only by Enterprise builds. This
// file is located in the grafana-enterprise repo.
//
// NOTE WELL: The extensions sets can import wiresets from wire.go, but sets in
// wire.go cannot include a build-specific wireset. The extension set must be built in wire.go.
//
// We use go build tags during build to configure which wiresets are used in a
// given build. We do not commit generated wire sets (wire_gen.go) into the
// repo.
