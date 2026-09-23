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

// DefaultCommitValue is the placeholder stamped in for a build commit when
// Grafana was not built from a repo carrying that information (a local/dev
// build). Binaries assign it as the default for their commit build vars, and
// printVersion treats an enterprise commit equal to this (or empty) as "not an
// enterprise build" and omits it from the version string.
const DefaultCommitValue = "NA"

// Config holds the startup inputs shared by every bootstrap entrypoint. CLI
// flag definitions stay in the CLI layer; their resolved values are passed here
// as plain data. Each entrypoint embeds this and adds its own initializer.
type Config struct {
	BuildInfo    BuildInfo
	Packaging    string
	IsEnterprise bool
	PidFile      string
	ConfigFile   string
	HomePath     string
	// ConfigOverrides is a space-separated string of config options that
	// override defaults, e.g. "cfg:default.paths.log=/dev/null".
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
