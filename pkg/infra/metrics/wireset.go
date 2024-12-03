package metrics

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	ProvideRegisterer,
	ProvideMultiGatherer,
)

var WireSetForTest = wire.NewSet(
	ProvideService,
	ProvideRegistererForTest,
	ProvideGathererForTest,
)
