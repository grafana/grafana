package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"

	"dagger.io/dagger"
	"github.com/urfave/cli/v3"
)

var (
	grafanaHost = "grafana"
	grafanaPort = 3001
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
				Name:      "config",
				Usage:     "Path to the pa11y config file to use",
				Value:     "e2e/pa11yci.conf.js",
				Validator: mustBeFile("config", true),
				TakesFile: true,
			},
			&cli.StringFlag{
				Name:      "results",
				Usage:     "Path to the pa11y results file to export",
				TakesFile: true,
			},
			&cli.BoolFlag{
				Name:  "no-threshold-fail",
				Usage: "Don't fail the task if any of the tests fail. Use this in combination with --results to list all violations even if they're within thresholds",
				Value: false,
			},
		},
		Action: run,
	}
}

func run(ctx context.Context, cmd *cli.Command) error {
	grafanaDir := cmd.String("grafana-dir")
	targzPath := cmd.String("package")
	licensePath := cmd.String("license")
	pa11yConfigPath := cmd.String("config")
	pa11yResultsPath := cmd.String("results")
	noThresholdFail := cmd.Bool("no-threshold-fail")

	d, err := dagger.Connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to connect to Dagger: %w", err)
	}

	// Explicitly only the files used by the grafana-server service
	hostSrc := d.Host().Directory(grafanaDir, dagger.HostDirectoryOpts{
		Include: []string{
			"./devenv",
			"./e2e/test-plugins", // Directory is included so provisioning works, but they're not actually build
			"./scripts/grafana-server/custom.ini",
			"./scripts/grafana-server/start-server",
			"./scripts/grafana-server/kill-server",
			"./scripts/grafana-server/variables",
		},
	})

	targz := d.Host().File(targzPath)
	pa11yConfig := d.Host().File(pa11yConfigPath)

	var license *dagger.File
	if licensePath != "" {
		license = d.Host().File(licensePath)
	}

	svc, err := GrafanaService(ctx, d, GrafanaServiceOpts{
		HostSrc:      hostSrc,
		GrafanaTarGz: targz,
		License:      license,
	})
	if err != nil {
		return fmt.Errorf("failed to create Grafana service: %w", err)
	}

	c, runErr := RunTest(ctx, d, svc, pa11yConfig, noThresholdFail, pa11yResultsPath)
	if runErr != nil {
		return fmt.Errorf("failed to run a11y test suite: %w", runErr)
	}

	c, syncErr := c.Sync(ctx)
	if syncErr != nil {
		return fmt.Errorf("failed to sync a11y test suite: %w", syncErr)
	}

	code, codeErr := c.ExitCode(ctx)
	if codeErr != nil {
		return fmt.Errorf("failed to get exit code of a11y test suite: %w", codeErr)
	}

	if code == 0 {
		log.Printf("a11y tests passed with exit code %d", code)
	} else if noThresholdFail {
		log.Printf("a11y tests failed with exit code %d, but noFail is true", code)
	} else {
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
