package apiserver

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var WireSet = wire.NewSet(
	builder.ProvideBuilderMetrics,
	ProvideEventualRestConfigProvider,
	wire.Bind(new(RestConfigProvider), new(*eventualRestConfigProvider)),
	wire.Bind(new(DirectRestConfigProvider), new(*eventualRestConfigProvider)),
	ProvideService,
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(builder.APIRegistrar), new(*service)),
	ProvideClientGenerator,
)

// BaseCLIWireSet provides the minimal set needed by CLI runners that don't start
// the full apiserver: the concrete rest config provider (bound to both interfaces)
// and the typed ClientGenerator — without ProvideService or its builder metrics.
var BaseCLIWireSet = wire.NewSet(
	ProvideEventualRestConfigProvider,
	wire.Bind(new(RestConfigProvider), new(*eventualRestConfigProvider)),
	wire.Bind(new(DirectRestConfigProvider), new(*eventualRestConfigProvider)),
	ProvideClientGenerator,
)
