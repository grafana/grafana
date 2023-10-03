package apiregistry

import (
	"context"

	playlistsv0alpha1 "github.com/grafana/grafana/pkg/apis/playlist/v0alpha1"
	testingv0alpha1 "github.com/grafana/grafana/pkg/apis/testing/v0alpha1"
	"github.com/grafana/grafana/pkg/registry"
)

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct{}

// ProvideService is an entry point for each service that will force initialization
// and give each builder the chance to register itself with the main server
func ProvideService(
	_ *playlistsv0alpha1.PlaylistAPIBuilder,
	_ *testingv0alpha1.TestingAPIBuilder,
) *Service {
	return &Service{}
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
