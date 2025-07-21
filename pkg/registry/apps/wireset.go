package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink,
	playlist.RegisterApp,
	investigations.RegisterApp,
	advisor.RegisterApp,
	notifications.RegisterApp,
)
