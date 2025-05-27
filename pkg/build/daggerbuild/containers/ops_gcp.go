package containers

import "github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"

// GCPOpts are options used when using Google Cloud Platform / the Google Cloud SDK.
type GCPOpts struct {
	ServiceAccountKey       string
	ServiceAccountKeyBase64 string
}

func GCPOptsFromFlags(c cliutil.CLIContext) *GCPOpts {
	return &GCPOpts{
		ServiceAccountKeyBase64: c.String("gcp-service-account-key-base64"),
		ServiceAccountKey:       c.String("gcp-service-account-key"),
	}
}
