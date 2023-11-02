package apiregistry

import (
	"github.com/google/wire"

	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	playlistV0 "github.com/grafana/grafana/pkg/registry/apis/playlist/v0alpha1"
)

var WireSet = wire.NewSet(
	ProvideRegistryServiceSink, // dummy background service that forces registration

	// Each must be added here *and* in the ServiceSink above
	playlistV0.RegisterAPIService,
	playlist.RegisterAPIService,
	example.RegisterAPIService,
)
