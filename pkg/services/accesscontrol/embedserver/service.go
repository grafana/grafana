package embedserver

import (
	"context"

	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage/memory"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	log      log.Logger

	srv *server.Server
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*Service, error) {
	s := &Service{
		cfg:      cfg,
		features: features,
		log:      log.New("accesscontrol.service"),
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	srv, err := s.newServer(ctx)
	if err != nil {
		return nil, err
	}

	s.srv = srv

	return s, nil
}
func (s *Service) newServer(ctx context.Context) (*server.Server, error) {
	return server.NewServerWithOpts(server.WithDatastore(memory.New()), server.WithLogger(logger.MustNewLogger("text", "info", "ISO8601")))
}
