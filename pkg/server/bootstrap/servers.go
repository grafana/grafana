package bootstrap

import (
	"context"
	"fmt"
	"os"
	"runtime/debug"
	"strings"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ServerInitializer builds the full Grafana server. OSS supplies the generated
// server.Initialize; Grafana Enterprise supplies its own Wire injector.
type ServerInitializer func(context.Context, *setting.Cfg, server.Options, api.ServerOptions) (*server.Server, error)

// ModuleServerInitializer builds a module server that targets specific dskit
// modules. OSS supplies the generated server.InitializeModuleServer; Grafana
// Enterprise supplies its own Wire injector.
type ModuleServerInitializer func(*setting.Cfg, server.Options, api.ServerOptions) (*server.ModuleServer, error)

// RunServerConfig is the input to RunServer: the shared startup Config plus the
// initializer that builds the full Grafana server.
type RunServerConfig struct {
	Config
	// Initialize builds the server. Required.
	Initialize ServerInitializer
}

// RunTargetServerConfig is the input to RunTargetServer: the shared startup
// Config plus the initializer that builds the module (target) server.
type RunTargetServerConfig struct {
	Config
	// Initialize builds the module server. Required.
	Initialize ModuleServerInitializer
}

// RunServer starts the full Grafana server: it handles version flags, sets up
// logging, diagnostics and panic recovery, records build metadata, loads
// configuration, initializes feature flags, builds the server via cfg.Initialize,
// installs signal handling and blocks on the run loop.
func RunServer(ctx context.Context, cfg RunServerConfig) error {
	if cfg.PrintVersion || cfg.VerboseVersion {
		printVersion(cfg.BuildInfo, cfg.VerboseVersion, true)
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

	SetBuildInfo(cfg.BuildInfo, cfg.Packaging, cfg.IsEnterprise)
	checkPrivileges()

	settingCfg, err := loadConfig(cfg.ConfigFile, cfg.HomePath, cfg.ConfigOverrides, cfg.ExtraArgs)
	if err != nil {
		return err
	}

	registerBuildMetrics(cfg.BuildInfo)

	// Initialize the OpenFeature feature flag system
	if err := featuremgmt.InitOpenFeatureWithCfg(settingCfg); err != nil {
		return err
	}
	settingCfg.ResolveGrafanaComProxyAPIToken()

	s, err := cfg.Initialize(
		ctx,
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

// RunTargetServer starts a Grafana module (target) server. It mirrors RunServer's
// startup sequence — version flags, logging, diagnostics, panic recovery, build
// metadata, config loading and feature-flag init — but builds a *server.ModuleServer
// via cfg.Initialize instead of the full server.
func RunTargetServer(ctx context.Context, cfg RunTargetServerConfig) error {
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

	SetBuildInfo(cfg.BuildInfo, cfg.Packaging, cfg.IsEnterprise)
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

// printVersion prints the build version to stdout, and when verbose is set,
// the full dependency list. When withEnterpriseCommit is true and an enterprise
// commit is present, it is included in the version line.
func printVersion(opts BuildInfo, verbose bool, withEnterpriseCommit bool) {
	if withEnterpriseCommit && opts.EnterpriseCommit != DefaultCommitValue && opts.EnterpriseCommit != "" {
		fmt.Printf("Version %s (commit: %s, branch: %s, enterprise-commit: %s)\n", opts.Version, opts.Commit, opts.BuildBranch, opts.EnterpriseCommit)
	} else {
		fmt.Printf("Version %s (commit: %s, branch: %s)\n", opts.Version, opts.Commit, opts.BuildBranch)
	}
	if verbose {
		fmt.Println("Dependencies:")
		if info, ok := debug.ReadBuildInfo(); ok {
			for _, dep := range info.Deps {
				fmt.Println(dep.Path, dep.Version)
			}
		}
	}
}

// loadConfig builds a setting.Cfg from the home path, config file, inline
// config overrides and trailing CLI arguments. Trailing arguments take
// precedence over the overrides string.
func loadConfig(configFile, homePath, configOverrides string, extraArgs []string) (*setting.Cfg, error) {
	configOptions := strings.Split(configOverrides, " ")
	return setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   configFile,
		HomePath: homePath,
		// trailing arguments have precedence over the options string
		Args: append(configOptions, extraArgs...),
	})
}

// registerBuildMetrics records version/commit/branch/build-stamp on the metrics
// registerer so build info is exported as a metric.
func registerBuildMetrics(opts BuildInfo) {
	metrics.SetBuildInformation(metrics.ProvideRegisterer(), opts.Version, opts.Commit, opts.BuildBranch, getBuildstamp(opts))
}
