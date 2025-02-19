package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink,
	playlist.RegisterApp,
	investigations.RegisterApp,
	advisor.RegisterApp,
	checkregistry.ProvideService,
	wire.Bind(new(checkregistry.CheckService), new(*checkregistry.Service)),
)
