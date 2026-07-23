package bootstrap

import (
	"context"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ModuleServerInitializer builds a module server that targets specific dskit
// modules. OSS supplies the generated server.InitializeModuleServer; Grafana
// Enterprise supplies its own Wire injector.
type ModuleServerInitializer func(*setting.Cfg, server.Options, api.ServerOptions) (*server.ModuleServer, error)

// RunTargetConfig is the complete set of inputs the bootstrap process needs to
// start a module (target) server.
type RunTargetConfig struct {
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
	// Initialize builds the module server. Required.
	Initialize ModuleServerInitializer
}

// RunTarget starts a Grafana module (target) server. It mirrors RunServer's
// startup sequence — version flags, logging, diagnostics, panic recovery, build
// metadata, config loading and feature-flag init — but builds a *server.ModuleServer
// via cfg.Initialize instead of the full server.
func RunTarget(ctx context.Context, cfg RunTargetConfig) error {
	if cfg.PrintVersion || cfg.VerboseVersion {
		printVersion(cfg.BuildInfo, cfg.VerboseVersion, false)
		return nil
	}

	logger := log.New("cli")
	defer func() {
		if err := log.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to close log: %s\n", err)
		}
	}()

	if err := setupDiagnostics(cfg.Diagnostics, logger); err != nil {
		return err
	}

	defer recoverAndLog(logger)

	SetBuildInfo(cfg.BuildInfo, cfg.Packaging)
	checkPrivileges()

	settingCfg, err := loadConfig(cfg.ConfigFile, cfg.HomePath, cfg.ConfigOverrides, cfg.ExtraArgs)
	if err != nil {
		return err
	}

	registerBuildMetrics(cfg.BuildInfo)

	// Initialize the OpenFeature client with the configuration
	if err := featuremgmt.InitOpenFeatureWithCfg(settingCfg); err != nil {
		return err
	}
	settingCfg.ResolveGrafanaComProxyAPIToken()

	s, err := cfg.Initialize(
		settingCfg,
		server.Options{
			PidFile:     cfg.PidFile,
			Version:     cfg.BuildInfo.Version,
			Commit:      cfg.BuildInfo.Commit,
			BuildBranch: cfg.BuildInfo.BuildBranch,
		},
		api.ServerOptions{},
	)
	if err != nil {
		return err
	}

	go listenToSystemSignals(ctx, s)
	return s.Run()
}
