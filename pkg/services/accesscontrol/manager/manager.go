package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/seeder"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// Manager is the service implementing role based access control.
type Manager struct {
	Cfg                          *setting.Cfg          `inject:""`
	RouteRegister                routing.RouteRegister `inject:""`
	Log                          log.Logger
	*database.AccessControlStore `inject:""`
}

func init() {
	registry.RegisterService(&Manager{})
}

// Init initializes the Manager.
func (m *Manager) Init() error {
	m.Log = log.New("accesscontrol")

	seeder := seeder.NewSeeder(m, m.Log)

	// TODO: Seed all orgs
	err := seeder.Seed(context.TODO(), 1)
	if err != nil {
		return err
	}

	return nil
}

func (m *Manager) IsDisabled() bool {
	if m.Cfg == nil {
		return true
	}

	_, exists := m.Cfg.FeatureToggles["accesscontrol"]
	return !exists
}

func (m *Manager) AddMigration(mg *migrator.Migrator) {
	if m.IsDisabled() {
		return
	}

	database.AddAccessControlMigrations(mg)
}
