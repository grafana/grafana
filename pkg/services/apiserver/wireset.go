package apiserver

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var WireSet = wire.NewSet(
	ProvideEventualRestConfigProvider,
	wire.Bind(new(RestConfigProvider), new(*EventualRestConfigProvider)),
	wire.Bind(new(DirectRestConfigProvider), new(*EventualRestConfigProvider)),
	ProvideService,
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(builder.APIRegistrar), new(*service)),
)
