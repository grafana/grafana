package metricsservice

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/infra/metrics"
)

var WireSet = wire.NewSet(
	ProvideService,
	metrics.ProvideRegisterer,
	metrics.ProvideGatherer,
)

var WireSetForTest = wire.NewSet(
	ProvideService,
	metrics.ProvideRegistererForTest,
	metrics.ProvideGathererForTest,
)
