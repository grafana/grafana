package preferences

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideWatcher,
	wire.Bind(new(Watcher), new(*watcher)),
)
