package apiregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	"github.com/grafana/grafana/pkg/registry/apis/snapshots"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// Each must be added here *and* in the ServiceSink above
	playlist.RegisterAPIService,
	example.RegisterAPIService,
	snapshots.RegisterAPIService,
)
