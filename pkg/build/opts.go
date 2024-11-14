package build

import (
	"flag"
	"runtime"
	"strings"
)

// BuildOpts are options provided to the build step
type BuildOpts struct {
	goarch string
	goos   string
	gocc   string
	cgo    bool
	libc   string

	pkgArch   string
	version   string
	buildTags []string
	// deb & rpm does not support semver so have to handle their version a little differently
	race            bool
	includeBuildID  bool
	buildID         string
	isDev           bool
	enterprise      bool
	skipRpmGen      bool
	skipDebGen      bool
	printGenVersion bool
}

// BuildOptsFromFlags reads the cmd args to assemble a BuildOpts object. This function calls flag.Parse()
func BuildOptsFromFlags() BuildOpts {
	opts := BuildOpts{}

	var buildIDRaw string
	var buildTagsRaw string

	flag.StringVar(&opts.goarch, "goarch", runtime.GOARCH, "GOARCH")
	flag.StringVar(&opts.goos, "goos", runtime.GOOS, "GOOS")
	flag.StringVar(&opts.gocc, "cc", "", "CC")
	flag.StringVar(&opts.libc, "libc", "", "LIBC")
	flag.StringVar(&buildTagsRaw, "build-tags", "", "Sets custom build tags")
	flag.BoolVar(&opts.cgo, "cgo-enabled", false, "Enable cgo")
	flag.StringVar(&opts.pkgArch, "pkg-arch", "", "PKG ARCH")
	flag.BoolVar(&opts.race, "race", false, "Use race detector")
	flag.BoolVar(&opts.includeBuildID, "includeBuildID", true, "IncludeBuildID in package name")
	flag.BoolVar(&opts.enterprise, "enterprise", false, "Build enterprise version of Grafana")
	flag.StringVar(&buildIDRaw, "buildID", "0", "Build ID from CI system")
	flag.BoolVar(&opts.isDev, "dev", false, "optimal for development, skips certain steps")
	flag.BoolVar(&opts.skipRpmGen, "skipRpm", false, "skip rpm package generation (default: false)")
	flag.BoolVar(&opts.skipDebGen, "skipDeb", false, "skip deb package generation (default: false)")
	flag.BoolVar(&opts.printGenVersion, "gen-version", false, "generate Grafana version and output (default: false)")
	flag.Parse()

	opts.buildID = shortenBuildID(buildIDRaw)

	if len(buildTagsRaw) > 0 {
		opts.buildTags = strings.Split(buildTagsRaw, ",")
	}

	if opts.pkgArch == "" {
		opts.pkgArch = opts.goarch
	}

	return opts
}
