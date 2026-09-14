package commands

import (
	"github.com/grafana/grafana/pkg/server/bootstrap"
)

// ServerDeps carries the edition-specific injectors and metadata that a binary's
// main supplies to the server commands. Passing these in keeps the commands
// package free of Wire and edition (pkg/extensions) coupling, so Grafana
// Enterprise can import and drive the same commands with its own injectors.
type ServerDeps struct {
	// Initialize builds the full Grafana server.
	Initialize bootstrap.ServerInitializer
	// ModuleInitialize builds the module (target) server.
	ModuleInitialize bootstrap.ModuleServerInitializer
	// IsEnterprise reports the edition; recorded on setting during startup.
	IsEnterprise bool
}

// bootstrapConfig maps the parsed CLI flags (see flags.go) and the supplied
// build info and deps into the edition-neutral bootstrap.Config shared by the
// server and target startup paths.
func bootstrapConfig(opts bootstrap.BuildInfo, deps ServerDeps, extraArgs []string) bootstrap.Config {
	return bootstrap.Config{
		BuildInfo:       opts,
		Packaging:       Packaging,
		IsEnterprise:    deps.IsEnterprise,
		PidFile:         PidFile,
		ConfigFile:      ConfigFile,
		HomePath:        HomePath,
		ConfigOverrides: ConfigOverrides,
		ExtraArgs:       extraArgs,
		Diagnostics: bootstrap.Diagnostics{
			Profile:              Profile,
			ProfileAddr:          ProfileAddr,
			ProfilePort:          ProfilePort,
			ProfileBlockRate:     ProfileBlockRate,
			ProfileMutexFraction: ProfileMutexFraction,
			Tracing:              Tracing,
			TracingFile:          TracingFile,
		},
		PrintVersion:   Version,
		VerboseVersion: VerboseVersion,
	}
}
