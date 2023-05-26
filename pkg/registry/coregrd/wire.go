package coregrd

import "github.com/google/wire"

var WireSet = wire.NewSet(
	New,
)
