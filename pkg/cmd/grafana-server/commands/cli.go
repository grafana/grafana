package commands

import (
	"context"
	"fmt"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	_ "github.com/grafana/pyroscope-go/godeltaprof/http/pprof"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/api"
	gcli "github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/process"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
)

func ServerCommand(version, commit, enterpriseCommit, buildBranch, buildstamp string) *cli.Command {
	return &cli.Command{
		Name:  "server",
		Usage: "run the grafana server",
		Flags: commonFlags,
		Action: func(context *cli.Context) error {
			return RunServer(standalone.BuildInfo{
				Version:          version,
				Commit:           commit,
				EnterpriseCommit: enterpriseCommit,
				BuildBranch:      buildBranch,
				BuildStamp:       buildstamp,
			}, context)
		},
		Subcommands: []*cli.Command{TargetCommand(version, commit, buildBranch, buildstamp)},
	}
}

func RunServer(opts standalone.BuildInfo, cli *cli.Context) error {
	if Version || VerboseVersion {
		if opts.EnterpriseCommit != gcli.DefaultCommitValue && opts.EnterpriseCommit != "" {
			fmt.Printf("Version %s (commit: %s, branch: %s, enterprise-commit: %s)\n", opts.Version, opts.Commit, opts.BuildBranch, opts.EnterpriseCommit)
		} else {
			fmt.Printf("Version %s (commit: %s, branch: %s)\n", opts.Version, opts.Commit, opts.BuildBranch)
		}
		if VerboseVersion {
			fmt.Println("Dependencies:")
			if info, ok := debug.ReadBuildInfo(); ok {
				for _, dep := range info.Deps {
					fmt.Println(dep.Path, dep.Version)
				}
			}
		}
		return nil
	}

	logger := log.New("cli")
	defer func() {
		if err := log.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to close log: %s\n", err)
		}
	}()

	if err := setupProfiling(Profile, ProfileAddr, ProfilePort, ProfileBlockRate, ProfileMutexFraction); err != nil {
		return err
	}
	if err := setupTracing(Tracing, TracingFile, logger); err != nil {
		return err
	}

	defer func() {
		// If we've managed to initialize them, this is the last place
		// where we're able to log anything that'll end up in Grafana's
		// log files.
		// Since operators are not always looking at stderr, we'll try
		// to log any and all panics that are about to crash Grafana to
		// our regular log locations before exiting.
		if r := recover(); r != nil {
			reason := fmt.Sprintf("%v", r)
			logger.Error("Critical error", "reason", reason, "stackTrace", string(debug.Stack()))
			panic(r)
		}
	}()

	SetBuildInfo(opts)
	checkPrivileges()

	configOptions := strings.Split(ConfigOverrides, " ")
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   ConfigFile,
		HomePath: HomePath,
		// tailing arguments have precedence over the options string
		Args: append(configOptions, cli.Args().Slice()...),
	})
	if err != nil {
		return err
	}

	metrics.SetBuildInformation(metrics.ProvideRegisterer(), opts.Version, opts.Commit, opts.BuildBranch, getBuildstamp(opts))

	ctx := context.Background()

	// Initialize the OpenFeature feature flag system
	if err := featuremgmt.InitOpenFeatureWithCfg(cfg); err != nil {
		return err
	}

	s, err := server.Initialize(
		ctx,
		cfg,
		server.Options{
			PidFile:     PidFile,
			Version:     opts.Version,
			Commit:      opts.Commit,
			BuildBranch: opts.BuildBranch,
		},
		api.ServerOptions{},
	)
	if err != nil {
		return err
	}

	go listenToSystemSignals(ctx, s)
	return s.Run()
}

func validPackaging(packaging string) string {
	validTypes := []string{"dev", "deb", "rpm", "docker", "brew", "hosted", "unknown"}
	for _, vt := range validTypes {
		if packaging == vt {
			return packaging
		}
	}
	return "unknown"
}

// a small interface satisfied by the server and moduleserver
type gserver interface {
	Shutdown(context.Context, string) error
}

func listenToSystemSignals(ctx context.Context, s gserver) {
	signalChan := make(chan os.Signal, 1)
	sighupChan := make(chan os.Signal, 1)

	signal.Notify(sighupChan, syscall.SIGHUP)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case <-sighupChan:
			if err := log.Reload(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to reload loggers: %s\n", err)
			}
		case sig := <-signalChan:
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			if err := s.Shutdown(ctx, fmt.Sprintf("System signal: %s", sig)); err != nil {
				fmt.Fprintf(os.Stderr, "Timed out waiting for server to shut down\n")
			}
			return
		}
	}
}

func checkPrivileges() {
	elevated, err := process.IsRunningWithElevatedPrivileges()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error checking server process execution privilege. error: %s\n", err.Error())
	}
	if elevated {
		fmt.Println("Grafana server is running with elevated privileges. This is not recommended")
	}
}
