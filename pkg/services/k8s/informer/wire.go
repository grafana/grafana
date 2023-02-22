package informer

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(ProvideFactory)
