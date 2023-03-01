package publicdashboard

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
)

var WireSet = wire.NewSet(
	ProvideWebhooks,
	ProvideWatcher,
	wire.Bind(new(Watcher), new(*watcher)),
	ProvideService,
	wire.Bind(new(publicdashboards.Service), new(*ServiceWrapper)),
)
