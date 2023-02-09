package dashboards

import "github.com/google/wire"

var WireSet = wire.NewSet(ProvideResource, ProvideService, ProvideController)
