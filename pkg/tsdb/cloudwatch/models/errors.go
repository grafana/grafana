package models

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// put misc expected user errors here

var ErrMissingRegion = backend.DownstreamErrorf("missing default region")
