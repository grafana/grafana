package commands

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"runtime/trace"
	"strconv"
	"syscall"
	"time"

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
}

type exitWithCode struct {
	reason string
	code   int
}

var serverFs = flag.NewFlagSet("server", flag.ContinueOnError)

var clilog = log.New("cli")

func (e exitWithCode) Error() string {
	return e.reason
}

func RunServer(opt ServerOptions) int {
	var (
		configFile = serverFs.String("config", "", "path to config file")
		homePath   = serverFs.String("homepath", "", "path to grafana install/home path, defaults to working directory")
		pidFile    = serverFs.String("pidfile", "", "path to pid file")
		packaging  = serverFs.String("packaging", "unknown", "describes the way Grafana was installed")

		v           = serverFs.Bool("v", false, "prints current version and exits")
		vv          = serverFs.Bool("vv", false, "prints current version, all dependencies and exits")
		profile     = serverFs.Bool("profile", false, "Turn on pprof profiling")
		profileAddr = serverFs.String("profile-addr", "localhost", "Define custom address for profiling")
		profilePort = serverFs.Uint64("profile-port", 6060, "Define custom port for profiling")
		tracing     = serverFs.Bool("tracing", false, "Turn on tracing")
		tracingFile = serverFs.String("tracing-file", "trace.out", "Define tracing output file")
	)

	if err := serverFs.Parse(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		return 1
	}

	if *v || *vv {
		fmt.Printf("Version %s (commit: %s, branch: %s)\n", opt.Version, opt.Commit, opt.BuildBranch)
		if *vv {
			fmt.Println("Dependencies:")
			if info, ok := debug.ReadBuildInfo(); ok {
				for _, dep := range info.Deps {
					fmt.Println(dep.Path, dep.Version)
				}
			}
		}
		return 0
	}

	profileDiagnostics := newProfilingDiagnostics(*profile, *profileAddr, *profilePort)
	if err := profileDiagnostics.overrideWithEnv(); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		return 1
	}

	traceDiagnostics := newTracingDiagnostics(*tracing, *tracingFile)
	if err := traceDiagnostics.overrideWithEnv(); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		return 1
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

	if err := executeServer(*configFile, *homePath, *pidFile, *packaging, traceDiagnostics, opt); err != nil {
		code := 1
		var ewc exitWithCode
		if errors.As(err, &ewc) {
			code = ewc.code
		}
		if code != 0 {
			fmt.Fprintf(os.Stderr, "%s\n", err.Error())
		}

		return code
	}

	return 0
}

func executeServer(configFile, homePath, pidFile, packaging string, traceDiagnostics *tracingDiagnostics, opt ServerOptions) error {
	defer func() {
		if err := log.Close(); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to close log: %s\n", err)
		}
	}()

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

	metrics.SetBuildInformation(opt.Version, opt.Commit, opt.BuildBranch)

	elevated, err := process.IsRunningWithElevatedPrivileges()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error checking server process execution privilege. error: %s\n", err.Error())
	}
	if elevated {
		fmt.Println("Grafana server is running with elevated privileges. This is not recommended")
	}

	s, err := server.Initialize(setting.CommandLineArgs{
		Config: configFile, HomePath: homePath, Args: serverFs.Args(),
	}, server.Options{
		PidFile: pidFile, Version: opt.Version, Commit: opt.Commit, BuildBranch: opt.BuildBranch,
	}, api.ServerOptions{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to start grafana. error: %s\n", err.Error())
		return err
	}

	ctx := context.Background()

	go listenToSystemSignals(ctx, s)

	if err := s.Run(); err != nil {
		code := s.ExitCode(err)
		return exitWithCode{
			reason: err.Error(),
			code:   code,
		}
	}

	return nil
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
