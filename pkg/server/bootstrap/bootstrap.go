// Package bootstrap contains the edition-neutral server startup lifecycle for
// Grafana: version handling, logging, diagnostics, panic recovery, build
// metadata, config loading, feature-flag init, signal handling and the run
// loop.
//
// It is independent of the CLI layer and of any particular edition — the
// Wire initializer is supplied by the caller (OSS passes the generated
// server.Initialize; Grafana Enterprise passes its own injector), which lets GE
// import and drive startup without the dual-repo overlay.
//
// The core Wire graph lives in the bootstrap/wire subpackage; this root package
// orchestrates the process around whichever initializer it is handed.
package bootstrap

// defaultEnterpriseCommit is the placeholder value used for the enterprise
// commit when Grafana was not built from the enterprise repo. A commit equal to
// this (or empty) marks a non-enterprise build, so printVersion omits the
// enterprise commit from the version string. The value matches grafana-cli's DefaultCommitValue;
// we redeclare it here so bootstrap doesn't have to import the CLI package. We will cut over in a later step
const defaultEnterpriseCommit = "NA"

// Config holds the startup inputs shared by every bootstrap entrypoint. CLI
// flag definitions stay in the CLI layer; their resolved values are passed here
// as plain data. Each entrypoint embeds this and adds its own initializer.
type Config struct {
	BuildInfo       BuildInfo
	Packaging       string
	PidFile         string
	ConfigFile      string
	HomePath        string
	ConfigOverrides string
	// ExtraArgs are trailing CLI arguments; they take precedence over
	// ConfigOverrides when merged into the config command-line args.
	ExtraArgs   []string
	Diagnostics Diagnostics
	// PrintVersion / VerboseVersion cause the version (and, when verbose, the
	// dependency list) to be printed before the process exits early.
	PrintVersion   bool
	VerboseVersion bool
}
