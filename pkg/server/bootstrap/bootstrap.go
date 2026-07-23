// Package bootstrap contains the edition-neutral server startup lifecycle for
// Grafana: version handling, logging, diagnostics, panic recovery, build
// metadata, config loading, feature-flag init, signal handling and the run
// loop. It is independent of the CLI layer and of any particular edition — the
// Wire initializer is supplied by the caller (OSS passes the generated
// server.Initialize; Grafana Enterprise passes its own injector), which lets GE
// import and drive startup without the dual-repo overlay.
//
// The core Wire graph lives in the bootstrap/wire subpackage; this root package
// orchestrates the process around whichever initializer it is handed.
package bootstrap

import (
	"context"
	"fmt"
	_ "net/http/pprof"
	"os"
	"runtime/debug"
	"strings"

	_ "github.com/grafana/pyroscope-go/godeltaprof/http/pprof"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// defaultEnterpriseCommit is the placeholder the build stamps in for the
// enterprise commit when Grafana was not built from the enterprise repo. When
// the enterprise commit is this value (or empty), it means this isn't an
// enterprise build, so it's left out of the printed version string. The value
// matches grafana-cli's DefaultCommitValue; we redeclare it here so bootstrap
// doesn't have to import the CLI package.
const defaultEnterpriseCommit = "NA"

// ServerInitializer builds the full Grafana server. OSS supplies the generated
// server.Initialize; Grafana Enterprise supplies its own Wire injector.
type ServerInitializer func(context.Context, *setting.Cfg, server.Options, api.ServerOptions) (*server.Server, error)

// RunServerConfig is the complete set of inputs the bootstrap process needs to
// start the full Grafana server. CLI flag definitions stay in the CLI layer;
// their resolved values are passed here as plain data.
type RunServerConfig struct {
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
	// Initialize builds the server. Required.
	Initialize ServerInitializer
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

	SetBuildInfo(cfg.BuildInfo, cfg.Packaging)
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

// printVersion prints the build version to stdout, and when verbose is set,
// the full dependency list. When withEnterpriseCommit is true and an enterprise
// commit is present, it is included in the version line.
func printVersion(opts BuildInfo, verbose bool, withEnterpriseCommit bool) {
	if withEnterpriseCommit && opts.EnterpriseCommit != defaultEnterpriseCommit && opts.EnterpriseCommit != "" {
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
