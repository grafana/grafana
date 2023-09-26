package apis

import (
	"github.com/google/wire"

	playlistsv0alpha1 "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
)

var WireSet = wire.NewSet(
	playlistsv0alpha1.RegisterAPIService,
)
