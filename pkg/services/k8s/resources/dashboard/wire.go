package dashboard

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

var WireSet = wire.NewSet(
	ProvideWatcher,
	wire.Bind(new(Watcher), new(*watcher)),
	ProvideServiceWrapper,
	wire.Bind(new(dashboards.DashboardServiceWrapper), new(*ServiceWrapper)),
)
