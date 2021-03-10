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

// AccessControlService is the service implementing role based access control.
type AccessControlService struct {
	Cfg           *setting.Cfg          `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	Log           log.Logger
	*database.AccessControlStore
}

func init() {
	registry.RegisterService(&AccessControlService{})
}

// Init initializes the AlertingService.
func (ac *AccessControlService) Init() error {
	ac.Log = log.New("accesscontrol")

	seeder := seeder.NewSeeder(ac, ac.Log)

	// TODO: Seed all orgs
	err := seeder.Seed(context.TODO(), 1)
	if err != nil {
		return err
	}

	return nil
}

func (ac *AccessControlService) IsDisabled() bool {
	_, exists := ac.Cfg.FeatureToggles["new_authz"]
	return !exists
}

func (ac *AccessControlService) AddMigration(mg *migrator.Migrator) {
	if ac.IsDisabled() {
		return
	}

	database.AddAccessControlMigrations(mg)
}
