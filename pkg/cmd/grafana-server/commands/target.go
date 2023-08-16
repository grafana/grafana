package commands

import (
	"context"
	"fmt"
	"os"
	"runtime/debug"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

// TargetCommand is the command for running a pared-down grafana server suitable
// for starting background tasks and dskit modules. It can be used to start all
// of Grafana, but by default the HTTPServer (and it's dependencies) do not
// start.
func TargetCommand(version, commit, buildBranch, buildstamp string) *cli.Command {
	return &cli.Command{
		Name:  "target",
		Usage: "target specific grafana dskit services",
		Flags: commonFlags,
		Action: func(context *cli.Context) error {
			return RunBaseServer(ServerOptions{
				Version:     version,
				Commit:      commit,
				BuildBranch: buildBranch,
				BuildStamp:  buildstamp,
				Context:     context,
			})
		},
	}
}

// RunBaseServer starts up a grafana server without the HTTPServer.
func RunBaseServer(opts ServerOptions) error {
	if Version || VerboseVersion {
		fmt.Printf("Version %s (commit: %s, branch: %s)\n", opts.Version, opts.Commit, opts.BuildBranch)
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

	if err := setupProfiling(Profile, ProfileAddr, ProfilePort); err != nil {
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

	setBuildInfo(opts)
	checkPrivileges()
	configOptions := strings.Split(ConfigOverrides, " ")
	s, err := server.InitializeModuleServer(
		setting.CommandLineArgs{
			Config:   ConfigFile,
			HomePath: HomePath,
			// tailing arguments have precedence over the options string
			Args: append(configOptions, opts.Context.Args().Slice()...),
		},
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

	ctx := context.Background()
	go listenToSystemSignals(ctx, s)
	return s.Run()
}
