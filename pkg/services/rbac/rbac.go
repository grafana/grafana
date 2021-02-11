package rbac

import (
	"context"

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

func (ac *RBACService) Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error) {
	q := GetUserPoliciesQuery{
		OrgId:  user.OrgId,
		UserId: user.UserId,
	}

	//TODO: Send context to `GetUserPolicies` so the SQL query can be cancelled.
	res, err := ac.GetUserPolicies(&q)
	if err != nil {
		return false, err
	}

	ok, dbScope := extractPermission(res, permission)
	if !ok {
		return false, nil
	}

	for _, s := range scope {
		if _, exists := dbScope[s]; !exists {
			return false, nil
		}
	}

	return true, nil
}

func extractPermission(policies []*PolicyDTO, permission string) (bool, map[string]struct{}) {
	scopes := map[string]struct{}{}
	ok := false

	for _, policy := range policies {
		if policy == nil {
			continue
		}
		for _, p := range policy.Permissions {
			if p.Permission == permission {
				ok = true
				scopes[p.Scope] = struct{}{}
			}
		}
	}

	return ok, scopes
}
