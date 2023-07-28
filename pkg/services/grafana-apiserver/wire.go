package grafanaapiserver

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	"github.com/grafana/grafana/pkg/setting"
)

var WireSet = wire.NewSet(
	ProvideService,
	wire.Bind(new(Service), new(*service)),
	wire.Bind(new(RestConfigProvider), new(*service)),
	ProvideModuleRegistration,
)

var DependencyWireSet = wire.NewSet(
	setting.NewCfgFromArgs,
	routing.ProvideRegister,
	wire.Bind(new(routing.RouteRegister), new(*routing.RouteRegisterImpl)),
)

var StandaloneWireSet = wire.NewSet(
	WireSet,
	DependencyWireSet,
	modules.WireSet,
	certgenerator.WireSet,
	ProvideStandalone,
)
