package dashboards

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

var WireSet = wire.NewSet(ProvideResource, ProvideService, ProvideController, wire.Bind(new(dashboards.DashboardServiceWrapper), new(*Service)))
