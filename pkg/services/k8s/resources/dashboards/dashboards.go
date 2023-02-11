package dashboards

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

var CRD = corecrd.New(nil).Dashboard()

var WireSet = wire.NewSet(ProvideResource, ProvideService, ProvideController, wire.Bind(new(dashboards.DashboardServiceWrapper), new(*ServiceWrapper)))
