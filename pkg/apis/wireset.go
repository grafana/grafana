package apis

import (
	"github.com/google/wire"

	datasourcesv0alpha1 "github.com/grafana/grafana/pkg/apis/datasources/v0alpha1"
	examplev0alpha1 "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	playlistsv0alpha1 "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
)

// WireSet is the list of all services
// NOTE: you must also register the service in: pkg/registry/apis/apis.go
var WireSet = wire.NewSet(
	playlistsv0alpha1.RegisterAPIService,
	examplev0alpha1.RegisterAPIService,
	datasourcesv0alpha1.RegisterAPIService,
)
