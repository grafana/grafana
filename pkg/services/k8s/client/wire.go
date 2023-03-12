package client

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideClientsetProvier,
	wire.Bind(new(ClientSetProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),
)
