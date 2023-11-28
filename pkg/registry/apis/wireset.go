package apiregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/apis"
)

var WireSet = wire.NewSet(
	ProvideService,
	apis.WireSet,
)
