package apiregistry

import (
	"context"

	playlistsv0alpha "github.com/grafana/grafana/pkg/apis/playlist/v0alpha"
	"github.com/grafana/grafana/pkg/registry"
)

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct{}

func ProvideService(
	_ *playlistsv0alpha.PlaylistAPIBuilder,
) *Service {
	return &Service{}
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
