package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink,
	playlist.RegisterApp,
	investigations.RegisterApp,
	advisor.RegisterApp,
	checkregistry.ProvideService,
	notifications.RegisterApp,
	shorturl.RegisterApp,
	wire.Bind(new(checkregistry.CheckService), new(*checkregistry.Service)),
)
