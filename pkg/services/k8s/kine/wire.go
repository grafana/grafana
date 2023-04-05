package kine

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(EtcdProvider), new(*service)),
	wire.Bind(new(Service), new(*service)),
)
