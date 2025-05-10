package commands

import (
    "context"
    "fmt"
    _ "net/http/pprof"
    "os"
    "os/signal"
    "regexp"
    "runtime/debug"
    "strings"
    "syscall"
    "time"

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

// Precompiled regex patterns for sensitive information (case-insensitive)
var sensitivePatterns = []*regexp.Regexp{
    regexp.MustCompile(`(?i)password`),
    regexp.MustCompile(`(?i)secret`),
    regexp.MustCompile(`(?i)token`),
    regexp.MustCompile(`(?i)apikey`),
    regexp.MustCompile(`(?i)authorization`),
}

// ServerCommand remains unchanged
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

    // Warn if running with elevated privileges
    if elevated, err := process.IsRunningWithElevatedPrivileges(); err != nil {
        logger.Warn("Error checking execution privileges", "error", err)
    } else if elevated {
        logger.Warn("Running with elevated privileges; consider running as non-root for security")
    }

    // Setup profiling (internal handles flags and defaults)
    if err := setupProfiling(Profile, ProfileAddr, ProfilePort, ProfileBlockRate, ProfileMutexFraction); err != nil {
        return fmt.Errorf("failed to setup profiling: %w", err)
    }

    if err := setupTracing(Tracing, TracingFile, logger); err != nil {
        return fmt.Errorf("failed to setup tracing: %w", err)
    }

    defer func() {
        if r := recover(); r != nil {
            reason := fmt.Sprintf("%v", r)
            // Sanitize stack trace to redact sensitive information
            safeStack := sanitizeStackTrace(string(debug.Stack()))
            logger.Error("Critical error", "reason", reason, "stackTrace", safeStack)
            os.Exit(1) // Safe termination
        }
    }()

    SetBuildInfo(opts)

    configOptions := strings.Split(ConfigOverrides, " ")
    cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
        Config:   ConfigFile,
        HomePath: HomePath,
        Args:     append(configOptions, cli.Args().Slice()...),
    })
    if err != nil {
        return fmt.Errorf("failed to load configuration: %w", err)
    }

    metrics.SetBuildInformation(metrics.ProvideRegisterer(), opts.Version, opts.Commit, opts.BuildBranch, getBuildstamp(opts))

    s, err := server.Initialize(
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
        return fmt.Errorf("failed to initialize server: %w", err)
    }

    ctx := context.Background()
    go listenToSystemSignals(ctx, s)
    return s.Run()
}

// sanitizeStackTrace redacts sensitive information from stack traces
func sanitizeStackTrace(stack string) string {
    lines := strings.Split(stack, "\n")
    var safeLines []string
    for _, line := range lines {
        redacted := line

        // Redact sensitive filesystem paths
        if strings.Contains(redacted, "/etc/") {
            redacted = strings.ReplaceAll(redacted, "/etc/", "[REDACTED]/")
        }

        // Redact sensitive keywords
        for _, pattern := range sensitivePatterns {
            redacted = pattern.ReplaceAllStringFunc(redacted, func(matched string) string {
                return "[REDACTED]"
            })
        }

        safeLines = append(safeLines, redacted)
    }
    return strings.Join(safeLines, "\n")
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
                log.New("cli").Error("Failed to reload loggers", "error", err)
            }
        case sig := <-signalChan:
            ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
            defer cancel()
            if err := s.Shutdown(ctx, fmt.Sprintf("System signal: %s", sig)); err != nil {
                log.New("cli").Error("Timed out waiting for server to shut down", "error", err)
            }
            return
        }
    }
}
