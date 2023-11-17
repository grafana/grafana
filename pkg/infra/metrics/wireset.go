package metrics

import (
	"github.com/google/wire"
	"github.com/prometheus/client_golang/prometheus"
)

var WireSet = wire.NewSet(
	ProvideService,
	ProvideRegistry,
	wire.Bind(new(Registry), new(*registry)),
	wire.Bind(new(prometheus.Registerer), new(*registry)),
	wire.Bind(new(prometheus.Gatherer), new(*registry)),
)

var WireSetForTest = wire.NewSet(
	ProvideService,
	ProvideRegistryForTest,
	wire.Bind(new(Registry), new(*registry)),
	wire.Bind(new(prometheus.Registerer), new(*registry)),
	wire.Bind(new(prometheus.Gatherer), new(*registry)),
)
