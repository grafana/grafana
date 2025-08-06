package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl"
)

var WireSet = wire.NewSet(
	ProvideAppInstallers,
	ProvideBuilderRunners,
	playlist.RegisterAppInstaller,
	investigations.RegisterApp,
	advisor.RegisterApp,
	notifications.RegisterApp,
	shorturl.RegisterAppInstaller,
)
