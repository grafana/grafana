package flags

import "github.com/urfave/cli/v2"

var PublishFlags = []cli.Flag{
	&cli.StringFlag{
		Name:    "destination",
		Usage:   "full URL to upload the artifacts to (examples: '/tmp/package.tar.gz', 'file://package.tar.gz', 'file:///tmp/package.tar.gz', 'gs://bucket/grafana/')",
		Aliases: []string{"d"},
		Value:   "dist",
	},
	&cli.BoolFlag{
		Name:  "checksum",
		Usage: "When enabled, also creates a `.sha256' checksum file in the destination that matches the checksum of the artifact(s) produced",
	},
}
