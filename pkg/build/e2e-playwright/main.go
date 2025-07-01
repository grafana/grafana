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
		Usage: "Run Grafana playwright e2e tests",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:      "grafana-dir",
				Usage:     "Path to the grafana/grafana clone directory",
				Value:     ".",
				Validator: mustBeDir("grafana-dir", false, false),
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
				Name:  "shard",
				Usage: "Test shard to run. See Playwright docs",
			},
			&cli.StringFlag{
				Name:      "results-dir",
				Usage:     "Path to the directory to export the playwright test results to (optional)",
				Validator: mustBeDir("results-dir", true, true),
			},
			&cli.StringFlag{
				Name:      "html-dir",
				Usage:     "Enables the HTML reporter, exported to this directory (optional)",
				Validator: mustBeDir("html-dir", true, true),
			},
			&cli.StringFlag{
				Name:      "blob-dir",
				Usage:     "Enables the blob reporter, exported to this directory. Useful with --shard (optional)",
				Validator: mustBeDir("blob-dir", true, true),
			},
		},
		Action: run,
	}
}

func run(ctx context.Context, cmd *cli.Command) error {
	grafanaDir := cmd.String("grafana-dir")
	targzPath := cmd.String("package")
	licensePath := cmd.String("license")
	pwShard := cmd.String("shard")
	resultsDir := cmd.String("results-dir")
	htmlDir := cmd.String("html-dir")
	blobDir := cmd.String("blob-dir")
	// pa11yConfigPath := cmd.String("config")
	// pa11yResultsPath := cmd.String("results")
	// noThresholdFail := cmd.Bool("no-threshold-fail")

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
	// pa11yConfig := d.Host().File(pa11yConfigPath)

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

	runOpts := RunTestOpts{
		GrafanaService:       svc,
		Shard:                pwShard,
		TestResultsExportDir: resultsDir,
		HTMLReportExportDir:  htmlDir,
		BlobReportExportDir:  blobDir,
	}

	c, runErr := RunTest(ctx, d, runOpts)
	if runErr != nil {
		return fmt.Errorf("failed to run e2e test suite: %w", runErr)
	}

	c, syncErr := c.Sync(ctx)
	if syncErr != nil {
		return fmt.Errorf("failed to sync e2e test suite: %w", syncErr)
	}

	code, codeErr := c.ExitCode(ctx)
	if codeErr != nil {
		return fmt.Errorf("failed to get exit code of e2e test suite: %w", codeErr)
	}

	if code == 0 {
		log.Printf("e2e tests passed with exit code %d", code)
	} else {
		return fmt.Errorf("e2e tests failed with exit code %d", code)
	}

	log.Println("e2e tests completed successfully")
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

func mustBeDir(arg string, emptyOk bool, notExistOk bool) func(string) error {
	return func(s string) error {
		if s == "" {
			if emptyOk {
				return nil
			}
			return cli.Exit(arg+" cannot be empty", 1)
		}
		stat, err := os.Stat(s)
		if err != nil {
			if notExistOk {
				return nil
			}
			return cli.Exit(arg+" does not exist or cannot be read: "+s, 1)
		}
		if !stat.IsDir() {
			return cli.Exit(arg+" must be a directory: "+s, 1)
		}
		return nil
	}
}
