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
	triesFlag = cli.IntFlag{
		Name:  "tries",
		Usage: "Specify number of tries before failing",
		Value: 1,
	}
	tagFlag = cli.StringFlag{
		Name:  "tag",
		Usage: "Grafana version tag",
	}
	securityFlag = cli.BoolFlag{
		Name:  "security",
		Usage: "Security release",
	}
	srcFlag = cli.StringFlag{
		Name:  "src-bucket",
		Value: "grafana-prerelease",
		Usage: "Google Cloud Storage bucket",
	}
	securityDestBucketFlag = cli.StringFlag{
		Name:  "security-dest-bucket",
		Usage: "Google Cloud Storage bucket for security packages (or $SECURITY_DEST_BUCKET)",
	}
	destFlag = cli.StringFlag{
		Name:  "dest-bucket",
		Value: "grafana-downloads",
		Usage: "Google Cloud Storage bucket for published packages",
	}
)
