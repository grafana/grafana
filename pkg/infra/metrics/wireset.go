package metrics

import (
	"github.com/grafana/grafana/pkg/build/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	ProvideRegisterer,
	ProvideGatherer,
)

var WireSetForTest = wire.NewSet(
	ProvideService,
	ProvideRegistererForTest,
	ProvideGathererForTest,
)
