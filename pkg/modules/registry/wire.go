package registry

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideRegistry,
	wire.Bind(new(Registry), new(*registry)),
)
