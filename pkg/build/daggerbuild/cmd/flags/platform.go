package flags

import "github.com/urfave/cli/v2"

var Platform = &cli.StringFlag{
	Name:  "platform",
	Usage: "The buildkit / dagger platform to run containers when building the backend",
	Value: DefaultPlatform,
}
