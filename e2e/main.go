package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/urfave/cli/v3"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	if err := Run().Run(ctx, os.Args); err != nil {
		cancel()
		fmt.Println(err)
		os.Exit(1)
	}
}

func Run() *cli.Command {
	var suitePath string

	return &cli.Command{
		Name:  "e2e",
		Usage: "Run the test suite",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "command",
				Usage: "Cypress command to run. 'open' can be useful for development (enum: run, open)",
				Value: "run",
				Validator: func(s string) error {
					if s != "run" && s != "open" {
						return fmt.Errorf("invalid command: %s, must be 'run' or 'open'", s)
					}
					return nil
				},
			},
			&cli.StringFlag{
				Name:  "browser",
				Usage: "Browser to run tests with (e.g.: chrome, electron)",
				Value: "chrome",
			},
			&cli.StringFlag{
				Name:  "grafana-base-url",
				Usage: "Base URL for Grafana",
				Value: "http://localhost:3001",
			},
			&cli.BoolFlag{
				Name:  "cypress-video",
				Usage: "Enable Cypress video recordings",
				Value: false,
			},
			&cli.BoolFlag{
				Name:  "smtp-plugin",
				Usage: "Enable SMTP plugin",
				Value: false,
			},
			&cli.BoolFlag{
				Name:  "benchmark-plugin",
				Usage: "Enable Benchmark plugin",
				Value: false,
			},
			&cli.BoolFlag{
				Name:  "slowmo",
				Usage: "Slow down the test run",
				Value: false,
			},
			&cli.StringSliceFlag{
				Name:  "env",
				Usage: "Additional Cypress environment variables to set (format: KEY=VALUE)",
				Validator: func(s []string) error {
					pattern := regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*=.*`)
					for _, v := range s {
						if !pattern.MatchString(v) {
							return fmt.Errorf("invalid environment variable format: %s, must be KEY=VALUE", v)
						}
					}
					return nil
				},
			},
			&cli.StringSliceFlag{
				Name:  "parameters",
				Usage: "Additional parameters to pass to the Cypress command (e.g. --headed)",
			},
			&cli.DurationFlag{
				Name:  "timeout",
				Usage: "Timeout for the Cypress command (precision: milliseconds)",
				Value: time.Second * 30,
				Validator: func(d time.Duration) error {
					if d < 0 {
						return fmt.Errorf("timeout must be a positive duration")
					}
					if d.Round(time.Millisecond) != d {
						return fmt.Errorf("timeout must be a whole number of milliseconds")
					}
					return nil
				},
			},
			&cli.StringFlag{
				Name:  "timezone",
				Usage: "Timezone to set for the Cypress run (e.g. 'America/New_York')",
				Value: "Pacific/Honolulu",
			},

			&cli.BoolFlag{
				Name:     "start-grafana",
				Usage:    "Start and wait for Grafana before running the tests",
				Value:    true,
				Category: "Grafana Server",
			},
			&cli.StringFlag{
				Name:      "license-path",
				Usage:     "Path to the Grafana Enterprise license file (optional; requires --start-grafana)",
				Value:     "",
				TakesFile: true,
				Category:  "Grafana Server",
			},
			&cli.BoolFlag{
				Name:     "image-renderer",
				Usage:    "Install the image renderer plugin (requires --start-grafana)",
				Category: "Grafana Server",
			},

			&cli.StringFlag{
				Name:        "suite",
				Usage:       "Path to the suite to run (e.g. './e2e/dashboards-suite')",
				TakesFile:   true,
				Required:    true,
				Destination: &suitePath,
			},
		},
		Action: runAction,
	}
}

func runAction(ctx context.Context, c *cli.Command) error {
	suitePath := c.String("suite")
	suitePath, err := normalisePath(suitePath)
	if err != nil {
		return fmt.Errorf("failed to normalise suite path: %w", err)
	}

	repoRoot, err := gitRepoRoot(ctx, suitePath)
	if err != nil {
		return fmt.Errorf("failed to get git repo root: %w", err)
	}

	screenshotsFolder := path.Join(suitePath, "screenshots")
	videosFolder := path.Join(suitePath, "videos")
	fileServerFolder := path.Join(repoRoot, "e2e", "cypress")
	fixturesFolder := path.Join(fileServerFolder, "fixtures")
	downloadsFolder := path.Join(fileServerFolder, "downloads")
	benchmarkPluginResultsFolder := path.Join(suitePath, "benchmark-results")
	reporter := path.Join(repoRoot, "e2e", "log-reporter.js")

	env := map[string]string{
		"BENCHMARK_PLUGIN_ENABLED":        fmt.Sprintf("%t", c.Bool("benchmark-plugin")),
		"SMTP_PLUGIN_ENABLED":             fmt.Sprintf("%t", c.Bool("smtp-plugin")),
		"BENCHMARK_PLUGIN_RESULTS_FOLDER": benchmarkPluginResultsFolder,
		"SLOWMO":                          "0",
		"BASE_URL":                        c.String("grafana-base-url"),
	}
	for _, v := range c.StringSlice("env") {
		parts := strings.SplitN(v, "=", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid environment variable format: %s, must be KEY=VALUE", v)
		}
		env[parts[0]] = parts[1]
	}

	cypressConfig := map[string]string{
		"screenshotsFolder": screenshotsFolder,
		"fixturesFolder":    fixturesFolder,
		"videosFolder":      videosFolder,
		"downloadsFolder":   downloadsFolder,
		"fileServerFolder":  fileServerFolder,
		"reporter":          reporter,

		"specPattern":           path.Join(suitePath, "*.spec.ts"),
		"defaultCommandTimeout": fmt.Sprintf("%d", c.Duration("timeout").Milliseconds()),
		"viewportWidth":         "1920",
		"viewportHeight":        "1080",
		"trashAssetsBeforeRuns": "false",
		"baseUrl":               c.String("grafana-base-url"),
		"video":                 fmt.Sprintf("%t", c.Bool("cypress-video")),
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	if c.Bool("start-grafana") {
		startServerPath := path.Join(repoRoot, "scripts", "grafana-server", "start-server")
		waitForGrafanaPath := path.Join(repoRoot, "scripts", "grafana-server", "wait-for-grafana")
		go func() {
			var args []string
			if c.String("license-path") != "" {
				args = append(args, c.String("license-path"))
			}
			//nolint:gosec
			cmd := exec.CommandContext(ctx, startServerPath, args...)
			cmd.Dir = repoRoot
			cmd.Env = os.Environ()
			cmd.Env = append(cmd.Env, fmt.Sprintf("TZ=%s", c.String("timezone")))
			if c.Bool("image-renderer") {
				cmd.Env = append(cmd.Env, "INSTALL_IMAGE_RENDERER=true")
			}
			cmd.Stdout = prefixGrafana(os.Stdout)
			cmd.Stderr = prefixGrafana(os.Stderr)
			cmd.Stdin = nil

			if err := cmd.Run(); err != nil {
				fmt.Println("Error running Grafana:", err)
			}
		}()

		//nolint:gosec
		cmd := exec.CommandContext(ctx, waitForGrafanaPath)
		cmd.Dir = repoRoot
		cmd.Env = os.Environ()
		cmd.Env = append(cmd.Env, fmt.Sprintf("TZ=%s", c.String("timezone")))
		cmd.Stdout = prefixGrafana(os.Stdout)
		cmd.Stderr = prefixGrafana(os.Stderr)
		cmd.Stdin = nil
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to wait for Grafana: %w", err)
		}
	}

	args := []string{"run", "cypress", c.String("command"),
		"--env", joinCypressCfg(env),
		"--config", joinCypressCfg(cypressConfig),
		"--browser", c.String("browser")}
	args = append(args, c.StringSlice("parameters")...)
	//nolint:gosec
	cmd := exec.CommandContext(ctx, "yarn", args...)
	cmd.Dir = repoRoot
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, fmt.Sprintf("TZ=%s", c.String("timezone")))
	cmd.Stdout = prefixCypress(os.Stdout)
	cmd.Stderr = prefixCypress(os.Stderr)
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

func gitRepoRoot(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "--show-toplevel")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get git repo root: %w", err)
	}
	p := strings.TrimSpace(string(out))
	p, err = normalisePath(p)
	if err != nil {
		return "", fmt.Errorf("failed to normalise git repo root path: %w", err)
	}
	return p, nil
}

func normalisePath(p string) (string, error) {
	absPath, err := filepath.Abs(p)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}
	return path.Clean(filepath.ToSlash(absPath)), nil
}

func joinCypressCfg(cfg map[string]string) string {
	config := make([]string, 0, len(cfg))
	for k, v := range cfg {
		config = append(config, fmt.Sprintf("%s=%s", k, v))
	}
	return strings.Join(config, ",")
}

const (
	resetColor  = "\033[0m"
	yellowColor = "\033[0;33m"
	cyanColor   = "\033[0;36m"
)

func prefixCypress(w io.Writer) io.Writer {
	if _, ok := os.LookupEnv("CI"); ok {
		return w
	}

	return newWrappingOutput(cyanColor+"Cypress: ", resetColor, w)
}

func prefixGrafana(w io.Writer) io.Writer {
	if _, ok := os.LookupEnv("CI"); ok {
		return w
	}

	return newWrappingOutput(yellowColor+"Grafana: ", resetColor, w)
}

var _ io.Writer = (*wrappingOutput)(nil)

type wrappingOutput struct {
	prefix        string
	suffix        string
	mu            *sync.Mutex
	inner         io.Writer
	writtenPrefix bool
}

func newWrappingOutput(prefix, suffix string, inner io.Writer) *wrappingOutput {
	return &wrappingOutput{
		prefix: prefix,
		suffix: suffix,
		mu:     &sync.Mutex{},
		inner:  inner,
	}
}

func (p *wrappingOutput) Write(b []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for line := range bytes.Lines(b) {
		if !p.writtenPrefix {
			if _, err := p.inner.Write([]byte(p.prefix)); err != nil {
				return 0, err
			}
			p.writtenPrefix = true
		}
		if _, err := p.inner.Write(line); err != nil {
			return 0, err
		}
		if bytes.HasSuffix(line, []byte("\n")) {
			p.writtenPrefix = false
			if _, err := p.inner.Write([]byte(p.suffix)); err != nil {
				return 0, err
			}
		}
	}
	return len(b), nil
}
