package apis

import (
	"github.com/google/wire"

	playlistsv0alpha1 "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	testingv0alpha1 "github.com/grafana/grafana/pkg/apis/testing/v0alpha1"
)

// NOTE: you must also register the service in: pkg/registry/apis/apis.go
var WireSet = wire.NewSet(
	playlistsv0alpha1.RegisterAPIService,
	testingv0alpha1.RegisterAPIService,
)
