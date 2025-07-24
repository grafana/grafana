package apiserver

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var WireSet = wire.NewSet(
	builder.ProvideDualWriterMetrics,
	builder.ProvideBuilderMetrics,
	ProvideEventualRestConfigProvider,
	wire.Bind(new(RestConfigProvider), new(*eventualRestConfigProvider)),
	wire.Bind(new(DirectRestConfigProvider), new(*eventualRestConfigProvider)),
	ProvideService,
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(builder.APIRegistrar), new(*service)),
)
