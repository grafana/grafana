package util

import "github.com/urfave/cli/v2"

var DryRunFlag = cli.BoolFlag{
	Name:  "dry-run",
	Usage: "Only simulate actions",
}
