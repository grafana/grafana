package authnz

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
)
