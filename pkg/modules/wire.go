package modules

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/setting"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(Engine), new(*service)),
	wire.Bind(new(Manager), new(*service)),
)

var DependencyWireSet = wire.NewSet(
	setting.NewCfgFromArgs,
)

var StandaloneWireSet = wire.NewSet(
	WireSet,
	DependencyWireSet,
)
