package serviceimpl

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(apiserver.RestConfigProvider), new(*service)),
	wire.Bind(new(apiserver.Service), new(*service)),
	wire.Bind(new(apiserver.DirectRestConfigProvider), new(*service)),
	wire.Bind(new(builder.APIRegistrar), new(*service)),
)
