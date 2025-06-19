package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"

	"dagger.io/dagger"
	"github.com/urfave/cli/v3"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	if err := NewApp().Run(ctx, os.Args); err != nil {
		cancel()
		fmt.Println(err)
		os.Exit(1)
	}
}

func NewApp() *cli.Command {
	return &cli.Command{
		Name:  "a11y",
		Usage: "Run Grafana accessibility tests",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:      "grafana-dir",
				Usage:     "Path to the grafana/grafana clone directory",
				Value:     ".",
				Validator: mustBeDir("grafana-dir"),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:      "package",
				Usage:     "Path to the grafana tar.gz package",
				Value:     "grafana.tar.gz",
				Validator: mustBeFile("package", false),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:      "license",
				Usage:     "Path to the Grafana Enterprise license file (optional)",
				Validator: mustBeFile("license", true),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:  "flags",
				Usage: "Flags to pass through to the e2e runner",
			},
		},
		Action: run,
	}
}

func run(ctx context.Context, cmd *cli.Command) error {
	grafanaDir := cmd.String("grafana-dir")
	targzPath := cmd.String("package")
	licensePath := cmd.String("license")
	runnerFlags := cmd.String("flags")

	d, err := dagger.Connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to connect to Dagger: %w", err)
	}

	yarnCache := d.CacheVolume("yarn")

	//nolint:gosec
	nvmrcContents, err := os.ReadFile(filepath.Join(grafanaDir, ".nvmrc"))
	if err != nil {
		return fmt.Errorf("failed to read .nvmrc file: %w", err)
	}
	nodeVersion := string(nvmrcContents)

	grafana := d.Host().Directory(grafanaDir, dagger.HostDirectoryOpts{
		Exclude: []string{"node_modules", "*.tar.gz"},
	})
	targz := d.Host().File(targzPath)

	var license *dagger.File
	if licensePath != "" {
		license = d.Host().File(licensePath)
	}

	svc, err := GrafanaService(ctx, d, GrafanaServiceOpts{
		GrafanaDir:   grafana,
		GrafanaTarGz: targz,
		License:      license,
		YarnCache:    yarnCache,
		NodeVersion:  nodeVersion,
	})
	if err != nil {
		return fmt.Errorf("failed to create Grafana service: %w", err)
	}

	c := RunTest(d, svc, grafana, yarnCache, nodeVersion, runnerFlags)
	c, err = c.Sync(ctx)
	if err != nil {
		return fmt.Errorf("failed to run a11y test suite: %w", err)
	}

	code, err := c.ExitCode(ctx)
	if err != nil {
		return fmt.Errorf("failed to get exit code of a11y test suite: %w", err)
	}
	if code != 0 {
		return fmt.Errorf("a11y tests failed with exit code %d", code)
	}

	log.Println("a11y tests completed successfully")
	return nil
}

func mustBeFile(arg string, emptyOk bool) func(string) error {
	return func(s string) error {
		if s == "" {
			if emptyOk {
				return nil
			}
			return cli.Exit(arg+" cannot be empty", 1)
		}
		stat, err := os.Stat(s)
		if err != nil {
			return cli.Exit(arg+" does not exist or cannot be read: "+s, 1)
		}
		if stat.IsDir() {
			return cli.Exit(arg+" must be a file, not a directory: "+s, 1)
		}
		return nil
	}
}

func mustBeDir(arg string) func(string) error {
	return func(s string) error {
		if s == "" {
			return cli.Exit(arg+" cannot be empty", 1)
		}
		stat, err := os.Stat(s)
		if err != nil {
			return cli.Exit(arg+" does not exist or cannot be read: "+s, 1)
		}
		if !stat.IsDir() {
			return cli.Exit(arg+" must be a directory: "+s, 1)
		}
		return nil
	}
}
