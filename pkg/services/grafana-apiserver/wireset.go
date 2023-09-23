package grafanaapiserver

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/apis"
	playlistv1 "github.com/grafana/grafana/pkg/apis/playlist/v1"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(RestConfigProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),

	// Each API Group
	playlistv1.RegisterAPIService,

	// The collection of all groups
	apis.ProvideGroupBuilderCollection,
)
