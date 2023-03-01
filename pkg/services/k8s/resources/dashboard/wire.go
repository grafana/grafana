package dashboard

import (
	"github.com/google/wire"
)

var WireSet = wire.NewSet(
	ProvideWatcher,
	wire.Bind(new(Watcher), new(*watcher)),
	// ProvideServiceWrapper,
	// wire.Bind(new(dashboards.DashboardServiceWrapper), new(*ServiceWrapper)),
	ProvideStoreWrapper, // Replaces the origiinal store
)
