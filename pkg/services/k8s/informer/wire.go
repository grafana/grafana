package informer

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideFactory,
	wire.Bind(new(Service), new(*factory)),
	wire.Bind(new(Informer), new(*factory)),
)
