package metrics

import (
	"github.com/google/wire"
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
