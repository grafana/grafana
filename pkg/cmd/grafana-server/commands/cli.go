package commands

import (
	"context"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"runtime/trace"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/extensions"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/process"
	"github.com/grafana/grafana/pkg/server"
	_ "github.com/grafana/grafana/pkg/services/alerting/conditions"
	_ "github.com/grafana/grafana/pkg/services/alerting/notifiers"
	"github.com/grafana/grafana/pkg/setting"
)

type ServerOptions struct {
	Version     string
	Commit      string
	BuildBranch string
	BuildStamp  string
	Context     *cli.Context
}

func ServerCommand(version, commit, buildBranch, buildstamp string) *cli.Command {
	return &cli.Command{
		Name:  "server",
		Usage: "run the grafana server",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "config",
				Usage: "Path to config file",
			},
			&cli.StringFlag{
				Name:  "homepath",
				Usage: "Path to Grafana install/home path, defaults to working directory",
			},
			&cli.StringFlag{
				Name:  "pidfile",
				Usage: "Path to Grafana pid file",
			},
			&cli.StringFlag{
				Name:  "packaging",
				Value: "unknown",
				Usage: "describes the way Grafana was installed",
			},
			&cli.StringFlag{
				Name:  "configOverrides",
				Usage: "Configuration options to override defaults as a string. e.g. cfg:default.paths.log=/dev/null",
			},
			cli.VersionFlag,
			&cli.BoolFlag{
				Name:  "vv",
				Usage: "prints current version, all dependencies and exits",
			},
			&cli.BoolFlag{
				Name:  "profile",
				Value: false,
				Usage: "Turn on pprof profiling",
			},
			&cli.StringFlag{
				Name:  "profile-addr",
				Value: "localhost",
				Usage: "Define custom address for profiling",
			},
			&cli.Uint64Flag{
				Name:  "profile-port",
				Value: 6060,
				Usage: "Define custom port for profiling",
			},
			&cli.BoolFlag{
				Name:  "tracing",
				Value: false,
				Usage: "Turn on tracing",
			},
			&cli.StringFlag{
				Name:  "tracing-file",
				Value: "trace.out",
				Usage: "Define tracing output file",
			},
		},
		Action: func(context *cli.Context) error {
			return RunServer(ServerOptions{
				Version:     version,
				Commit:      commit,
				BuildBranch: buildBranch,
				BuildStamp:  buildstamp,
				Context:     context,
			})
		},
	}
}

func RunServer(opt ServerOptions) error {
	var (
		configFile = opt.Context.String("config")
		homePath   = opt.Context.String("homepath")
		pidFile    = opt.Context.String("pidfile")
		packaging  = opt.Context.String("packaging")

		configOverrides = opt.Context.String("configOverrides")

		v           = opt.Context.Bool("version")
		vv          = opt.Context.Bool("vv")
		profile     = opt.Context.Bool("profile")
		profileAddr = opt.Context.String("profile-addr")
		profilePort = opt.Context.Uint64("profile-port")
		tracing     = opt.Context.Bool("tracing")
		tracingFile = opt.Context.String("tracing-file")
	)

	if v || vv {
		fmt.Printf("Version %s (commit: %s, branch: %s)\n", opt.Version, opt.Commit, opt.BuildBranch)
		if vv {
			fmt.Println("Dependencies:")
			if info, ok := debug.ReadBuildInfo(); ok {
				for _, dep := range info.Deps {
					fmt.Println(dep.Path, dep.Version)
				}
			}
		}
		return nil
	}

	profileDiagnostics := newProfilingDiagnostics(profile, profileAddr, profilePort)
	if err := profileDiagnostics.overrideWithEnv(); err != nil {
		return err
	}

	traceDiagnostics := newTracingDiagnostics(tracing, tracingFile)
	if err := traceDiagnostics.overrideWithEnv(); err != nil {
		return err
	}

	if profileDiagnostics.enabled {
		fmt.Println("diagnostics: pprof profiling enabled", "addr", profileDiagnostics.addr, "port", profileDiagnostics.port)
		runtime.SetBlockProfileRate(1)
		go func() {
			// TODO: We should enable the linter and fix G114 here.
			//	G114: Use of net/http serve function that has no support for setting timeouts (gosec)
			//
			//nolint:gosec
			err := http.ListenAndServe(fmt.Sprintf("%s:%d", profileDiagnostics.addr, profileDiagnostics.port), nil)
			if err != nil {
				panic(err)
			}
		}()
	}

	defer func() {
		if err := log.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to close log: %s\n", err)
		}
	}()

	clilog := log.New("cli")

	defer func() {
		// If we've managed to initialize them, this is the last place
		// where we're able to log anything that'll end up in Grafana's
		// log files.
		// Since operators are not always looking at stderr, we'll try
		// to log any and all panics that are about to crash Grafana to
		// our regular log locations before exiting.
		if r := recover(); r != nil {
			reason := fmt.Sprintf("%v", r)
			clilog.Error("Critical error", "reason", reason, "stackTrace", string(debug.Stack()))
			panic(r)
		}
	}()

	if traceDiagnostics.enabled {
		fmt.Println("diagnostics: tracing enabled", "file", traceDiagnostics.file)
		f, err := os.Create(traceDiagnostics.file)
		if err != nil {
			panic(err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				clilog.Error("Failed to write trace diagnostics", "path", traceDiagnostics.file, "err", err)
			}
		}()

		if err := trace.Start(f); err != nil {
			panic(err)
		}
		defer trace.Stop()
	}

	buildstampInt64, err := strconv.ParseInt(opt.BuildStamp, 10, 64)
	if err != nil || buildstampInt64 == 0 {
		buildstampInt64 = time.Now().Unix()
	}

	setting.BuildVersion = opt.Version
	setting.BuildCommit = opt.Commit
	setting.BuildStamp = buildstampInt64
	setting.BuildBranch = opt.BuildBranch
	setting.IsEnterprise = extensions.IsEnterprise
	setting.Packaging = validPackaging(packaging)

	metrics.SetBuildInformation(opt.Version, opt.Commit, opt.BuildBranch, buildstampInt64)

	elevated, err := process.IsRunningWithElevatedPrivileges()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error checking server process execution privilege. error: %s\n", err.Error())
	}
	if elevated {
		fmt.Println("Grafana server is running with elevated privileges. This is not recommended")
	}

	configOptions := strings.Split(configOverrides, " ")

	s, err := server.Initialize(
		setting.CommandLineArgs{
			Config:   configFile,
			HomePath: homePath,
			// tailing arguments have precedence over the options string
			Args: append(configOptions, opt.Context.Args().Slice()...),
		},
		server.Options{
			PidFile:     pidFile,
			Version:     opt.Version,
			Commit:      opt.Commit,
			BuildBranch: opt.BuildBranch,
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

func validPackaging(packaging string) string {
	validTypes := []string{"dev", "deb", "rpm", "docker", "brew", "hosted", "unknown"}
	for _, vt := range validTypes {
		if packaging == vt {
			return packaging
		}
	}
	return "unknown"
}

func listenToSystemSignals(ctx context.Context, s *server.Server) {
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
