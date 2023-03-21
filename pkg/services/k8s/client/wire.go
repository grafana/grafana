package client

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideClientsetProvider,
	wire.Bind(new(ClientSetProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),
)
