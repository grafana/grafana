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

	seeder := &seeder{
		Service: ac,
		log:     ac.log,
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
	roles := []string{string(user.OrgRole)}
	for _, role := range user.OrgRole.Children() {
		roles = append(roles, string(role))
	}
	if user.IsGrafanaAdmin {
		roles = append(roles, "Grafana Admin")
	}

	res, err := ac.GetUserPermissions(ctx, GetUserPermissionsQuery{
		OrgId:  user.OrgId,
		UserId: user.UserId,
		Roles:  roles,
	})
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

func extractPermission(permissions []*Permission, permission string) (bool, map[string]struct{}) {
	scopes := map[string]struct{}{}
	ok := false

	for _, p := range permissions {
		if p == nil {
			continue
		}
		if p.Permission == permission {
			ok = true
			scopes[p.Scope] = struct{}{}
		}
	}

	return ok, scopes
}
