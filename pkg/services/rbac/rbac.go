package rbac

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// RBACService is the service implementing role based access control.
type RBACService struct {
	Cfg           *setting.Cfg          `inject:""`
	RouteRegister routing.RouteRegister `inject:""`
	SQLStore      *sqlstore.SQLStore    `inject:""`
	log           log.Logger
}

func init() {
	registry.RegisterService(&RBACService{})
}

// Init initializes the AlertingService.
func (ac *RBACService) Init() error {
	ac.log = log.New("rbac")

	return nil
}

func (ac *RBACService) AddMigration(mg *migrator.Migrator) {
	addRBACMigrations(mg)
}

func (ac *RBACService) Evaluate(c *models.ReqContext) *EvaluationResult {
	return &EvaluationResult{
		HasAccess: false,
	}
}
