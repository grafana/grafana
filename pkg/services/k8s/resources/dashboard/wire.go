package dashboard

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

var WireSet = wire.NewSet(
	ProvideServiceWrapper,
	wire.Bind(new(dashboards.DashboardServiceWrapper), new(*ServiceWrapper)),
)
