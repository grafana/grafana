package kvstore

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(SecretsKVStore), new(*service)),
	wire.Bind(new(Runner), new(*service)),
)
