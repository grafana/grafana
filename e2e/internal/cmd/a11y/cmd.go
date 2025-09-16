package a11y

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"

	"github.com/grafana/grafana/e2e/internal/fpaths"
	"github.com/grafana/grafana/e2e/internal/outs"
	"github.com/urfave/cli/v3"
)

func NewCmd() *cli.Command {
	return &cli.Command{
		Name:  "a11y",
		Usage: "Run accessibility tests on the Grafana frontend",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:      "config",
				Usage:     "Path to the accessibility test configuration file",
				Required:  true,
				TakesFile: true,
			},
			&cli.BoolFlag{
				Name:  "json",
				Usage: "Output results in JSON format",
				Value: false,
			},

			&cli.StringFlag{
				Name:  "grafana-host",
				Usage: "Host for the Grafana server",
				Value: "localhost",
			},
			&cli.Uint16Flag{
				Name:  "grafana-port",
				Usage: "Port for the Grafana server",
				Value: 3001,
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
		},
		Action: runAction,
	}
}

func runAction(ctx context.Context, c *cli.Command) error {
	cfgPath, err := fpaths.NormalisePath(c.String("config"))
	if err != nil {
		return fmt.Errorf("failed to normalise config path %q: %w", c.String("config"), err)
	}

	repoRoot, err := fpaths.RepoRoot(ctx, ".")
	if err != nil {
		return fmt.Errorf("failed to get repository root: %w", err)
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	if c.Bool("start-grafana") {
		startServerPath := path.Join(repoRoot, "scripts", "grafana-server", "start-server")
		waitForGrafanaPath := path.Join(repoRoot, "scripts", "grafana-server", "wait-for-grafana")
		go func() {
			defer cancel()
			var args []string
			if c.String("license-path") != "" {
				args = append(args, c.String("license-path"))
			}
			//nolint:gosec
			cmd := exec.CommandContext(ctx, startServerPath, args...)
			cmd.Dir = repoRoot
			cmd.Env = os.Environ()
			cmd.Env = append(cmd.Env, fmt.Sprintf("TZ=%s", c.String("timezone")))
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

	args := []string{"run", "pa11y-ci", "--config", cfgPath}
	if c.Bool("json") {
		args = append(args, "--json")
	}
	//nolint:gosec
	cmd := exec.CommandContext(ctx, "yarn", args...)
	cmd.Dir = repoRoot
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env,
		fmt.Sprintf("HOST=%s", c.String("grafana-host")),
		fmt.Sprintf("PORT=%d", c.Uint16("grafana-port")))
	cmd.Stdout = prefixA11y(os.Stdout)
	cmd.Stderr = prefixA11y(os.Stderr)
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

func prefixA11y(w io.Writer) io.Writer {
	return outs.Prefix(w, "A11y", outs.CyanColor)
}

func prefixGrafana(w io.Writer) io.Writer {
	return outs.Prefix(w, "Grafana", outs.YellowColor)
}
