package spicedb

import "github.com/google/wire"

var WireSet = wire.NewSet(ProvideService)
