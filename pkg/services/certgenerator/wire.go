package certgenerator

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(Service), new(*service)),
)
