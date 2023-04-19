package team

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideWatcher,
)
