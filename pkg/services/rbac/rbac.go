package rbac

import (
	"context"

	"github.com/gobwas/glob"

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

	if _, exists := ac.Cfg.FeatureToggles["new_authz"]; !exists {
		return nil
	}

	seeder := seeder{
		Service: ac,
	}

	// TODO: Seed all orgs
	err := seeder.Seed(context.TODO(), 1)
	if err != nil {
		return err
	}

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

	res, err := ac.GetUserPolicies(ctx, &q)
	if err != nil {
		return false, err
	}

	ok, dbScopes := extractPermission(res, permission)
	if !ok {
		return false, nil
	}

	for _, s := range scope {
		var match bool
		for dbScope := range dbScopes {
			rule, err := glob.Compile(dbScope, ':', '/')
			if err != nil {
				return false, err
			}

			match = rule.Match(s)
			if match {
				break
			}
		}

		if !match {
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
