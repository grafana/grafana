package appregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apps/investigation"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink,
	playlist.RegisterApp,
	investigation.RegisterApp,
)
