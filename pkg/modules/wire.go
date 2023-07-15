package modules

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(Engine), new(*service)),
	wire.Bind(new(Manager), new(*service)),
)
