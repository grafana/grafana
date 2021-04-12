package store

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// LiveStore ...
type LiveStore struct {
	Cfg           *setting.Cfg          `inject:""`
	SQLStore      *sqlstore.SQLStore    `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	log           log.Logger
}

func init() {
	registry.RegisterService(&LiveStore{})
}

// Init initializes the LibraryPanel service
func (s *LiveStore) Init() error {
	s.log = log.New("live_store")
	return nil
}

// IsEnabled returns true if the Panel Library feature is enabled for this instance.
func (s *LiveStore) IsEnabled() bool {
	if s.Cfg == nil {
		return false
	}
	return s.Cfg.IsLiveEnabled()
}
