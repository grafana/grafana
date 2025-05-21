package containers

import (
	"errors"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
)

// PublishOpts fields are selectively used based on the protocol field of the destination.
// Be sure to fill out the applicable fields (or all of them) when calling a 'Publish' func.
type PublishOpts struct {
	// Destination is any URL to publish an artifact(s) to.
	// Examples:
	// * '/tmp/package.tar.gz'
	// * 'file:///tmp/package.tar.gz'
	// * 'gcs://bucket/package.tar.gz'
	Destination string

	// Checksum defines if the PublishFile function should also produce / publish a checksum of the given `*dagger.File'
	Checksum bool
}

func PublishOptsFromFlags(c cliutil.CLIContext) *PublishOpts {
	return &PublishOpts{
		Destination: c.String("destination"),
		Checksum:    c.Bool("checksum"),
	}
}

var ErrorUnrecognizedScheme = errors.New("unrecognized scheme")

type PublishFileOpts struct {
	File        *dagger.File
	PublishOpts *PublishOpts
	GCPOpts     *GCPOpts
	Destination string
}
