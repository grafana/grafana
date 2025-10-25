package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/correlations"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/logsdrilldown"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/plugins"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl"
)

var WireSet = wire.NewSet(
	ProvideAppInstallers,
	ProvideBuilderRunners,
	playlist.RegisterAppInstaller,
	investigations.RegisterApp,
	// TODO: Enable this conditionally, when running the advisor locally
	advisor.RegisterApp,
	plugins.RegisterAppInstaller,
	shorturl.RegisterAppInstaller,
	correlations.RegisterAppInstaller,
	rules.RegisterAppInstaller,
	notifications.RegisterAppInstaller,
	logsdrilldown.RegisterAppInstaller,
)
