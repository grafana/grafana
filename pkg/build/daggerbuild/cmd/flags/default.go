package flags

import "github.com/urfave/cli/v2"

var Verbose = &cli.BoolFlag{
	Name:    "verbose",
	Aliases: []string{"v"},
	Usage:   "Increase log verbosity. WARNING: This setting could potentially log sensitive data",
	Value:   false,
}

var DefaultFlags = []cli.Flag{
	Platform,
	Verbose,
}
