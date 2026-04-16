package correlations

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	ProvideLegacyService,
)
