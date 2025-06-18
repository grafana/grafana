package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink,
	playlist.RegisterApp,
	investigations.RegisterApp,
	advisor.RegisterApp,
	checkregistry.ProvideService,
	notifications.RegisterApp,
	rules.RegisterApp,
	wire.Bind(new(checkregistry.CheckService), new(*checkregistry.Service)),
)

// http://localhost:3000/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/receivers
