package grafanaapiserver

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(RestConfigProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(APIRegistrar), new(*service)),
	wire.Bind(new(DirectRestConfigProvider), new(*service)),
)
