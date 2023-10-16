package grafanaapiserver

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/auth/authorizer"
)

var WireSet = wire.NewSet(
	ProvideConfig,
	ProvideService,
	wire.Bind(new(RestConfigProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(APIRegistrar), new(*service)),
	authorizer.WireSet,
)
