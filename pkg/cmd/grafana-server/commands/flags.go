package commands

import (
	"runtime"

	"github.com/urfave/cli/v2"
)

// flags for the grafana server command(s)
var (
	ConfigFile           string
	HomePath             string
	PidFile              string
	Packaging            string
	ConfigOverrides      string
	Version              bool
	VerboseVersion       bool
	Profile              bool
	ProfileAddr          string
	ProfilePort          uint64
	ProfileBlockRate     int
	ProfileMutexFraction int
	ProfileContention    bool
	Tracing              bool
	TracingFile          string
)

var commonFlags = []cli.Flag{
	&cli.StringFlag{
		Name:        "config",
		Usage:       "Path to config file",
		Destination: &ConfigFile,
	},
	&cli.StringFlag{
		Name:        "homepath",
		Usage:       "Path to Grafana install/home path, defaults to working directory",
		Destination: &HomePath,
	},
	&cli.StringFlag{
		Name:        "pidfile",
		Usage:       "Path to Grafana pid file",
		Destination: &PidFile,
	},
	&cli.StringFlag{
		Name:        "packaging",
		Value:       "unknown",
		Usage:       "describes the way Grafana was installed",
		Destination: &Packaging,
	},
	&cli.StringFlag{
		Name:        "configOverrides",
		Usage:       "Configuration options to override defaults as a string. e.g. cfg:default.paths.log=/dev/null",
		Destination: &ConfigOverrides,
	},
	&cli.BoolFlag{
		Name:               "version",
		Aliases:            []string{"v"},
		Usage:              "print the version",
		DisableDefaultText: true,
		Destination:        &Version,
	},
	&cli.BoolFlag{
		Name:        "vv",
		Usage:       "prints current version, all dependencies and exits",
		Destination: &VerboseVersion,
	},
	&cli.BoolFlag{
		Name:        "profile",
		Value:       false,
		Usage:       "Turn on pprof profiling",
		Destination: &Profile,
	},
	&cli.StringFlag{
		Name:        "profile-addr",
		Value:       "localhost",
		Usage:       "Define custom address for profiling",
		Destination: &ProfileAddr,
	},
	&cli.Uint64Flag{
		Name:        "profile-port",
		Value:       6060,
		Usage:       "Define custom port for profiling",
		Destination: &ProfilePort,
	},
	&cli.IntFlag{
		Name:        "profile-block-rate",
		Value:       1,
		Usage:       "Controls the fraction of goroutine blocking events that are reported in the blocking profile. The profiler aims to sample an average of one blocking event per rate nanoseconds spent blocked. To turn off profiling entirely, use 0",
		Destination: &ProfileBlockRate,
	},
	&cli.IntFlag{
		Name:        "profile-mutex-rate",
		Value:       runtime.SetMutexProfileFraction(-1),
		Usage:       "Controls the fraction of mutex contention events that are reported in the mutex profile. On average 1/rate events are reported. To turn off mutex profiling entirely, use 0",
		Destination: &ProfileMutexFraction,
	},
	&cli.BoolFlag{
		Name:        "tracing",
		Value:       false,
		Usage:       "Turn on tracing",
		Destination: &Tracing,
	},
	&cli.StringFlag{
		Name:        "tracing-file",
		Value:       "trace.out",
		Usage:       "Define tracing output file",
		Destination: &TracingFile,
	},
}
