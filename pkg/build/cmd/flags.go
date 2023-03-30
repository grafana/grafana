package main

import "github.com/urfave/cli/v2"

var (
	jobsFlag = cli.IntFlag{
		Name:  "jobs",
		Usage: "Number of parallel jobs",
	}
	buildIDFlag = cli.StringFlag{
		Name:  "build-id",
		Usage: "Optionally supply a build ID to be part of the version",
	}
	editionFlag = cli.StringFlag{
		Name:  "edition",
		Usage: "The edition of Grafana to build (oss or enterprise)",
		Value: "oss",
	}
	variantsFlag = cli.StringFlag{
		Name:  "variants",
		Usage: "Comma-separated list of variants to build",
	}
	triesFlag = cli.IntFlag{
		Name:  "tries",
		Usage: "Specify number of tries before failing",
		Value: 1,
	}
	noInstallDepsFlag = cli.BoolFlag{
		Name:  "no-install-deps",
		Usage: "Don't install dependencies",
	}
	signingAdminFlag = cli.BoolFlag{
		Name:  "signing-admin",
		Usage: "Use manifest signing admin API endpoint?",
	}
	signFlag = cli.BoolFlag{
		Name:  "sign",
		Usage: "Enable plug-in signing (you must set GRAFANA_API_KEY)",
	}
	dryRunFlag = cli.BoolFlag{
		Name:  "dry-run",
		Usage: "Only simulate actions",
	}
	gitHubTokenFlag = cli.StringFlag{
		Name:    "github-token",
		Value:   "",
		EnvVars: []string{"GITHUB_TOKEN"},
		Usage:   "GitHub token",
	}
	tagFlag = cli.StringFlag{
		Name:  "tag",
		Usage: "Grafana version tag",
	}
)
