package apis

import (
	"github.com/google/wire"

	playlistv1 "github.com/grafana/grafana/pkg/apis/playlist/v0alpha"
)

var WireSet = wire.NewSet(
	playlistv1.RegisterAPIService,
)
