package flags

import (
	"runtime"

	"github.com/urfave/cli/v2"
)

var ConcurrencyFlags = []cli.Flag{
	&cli.Int64Flag{
		Name:        "parallel",
		Usage:       "The number of parallel pipelines to run. This can be particularly useful for building for multiple distributions at the same time",
		DefaultText: "Just like with 'go test', this defaults to GOMAXPROCS",
		Value:       int64(runtime.GOMAXPROCS(0)),
	},
}
