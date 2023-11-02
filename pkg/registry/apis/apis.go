package apiregistry

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/example"
	"github.com/grafana/grafana/pkg/registry/apis/playlist"
	playlistV0 "github.com/grafana/grafana/pkg/registry/apis/playlist/v0alpha1"
)

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct{}

// ProvideRegistryServiceSink is an entry point for each service that will force initialization
// and give each builder the chance to register itself with the main server
func ProvideRegistryServiceSink(
	_ *playlistV0.PlaylistAPIBuilder,
	_ *playlist.PlaylistAPIBuilder,
	_ *example.TestingAPIBuilder,
) *Service {
	return &Service{}
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
