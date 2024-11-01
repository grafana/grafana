package appregistry

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink,
)
