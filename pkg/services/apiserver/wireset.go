package apiserver

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/apiserver/builder"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(RestConfigProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(DirectRestConfigProvider), new(*service)),
	wire.Bind(new(builder.APIRegistrar), new(*service)),
)
