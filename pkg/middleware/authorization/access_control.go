package authorization

import (
	"github.com/grafana/grafana/pkg/registry"
	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resource
	Evaluate(ctx *models.ReqContext, user *models.SignedInUser, permission string, scope ...string) (bool, error)
}

func Middleware(ac AccessControl) func(string, ...string) macaron.Handler {
	return func(permission string, scopes ...string) macaron.Handler {
		return func(c *models.ReqContext) {
			hasAccess, err := ac.Evaluate(c, c.SignedInUser, permission, scopes...)
			if err != nil {
				c.Logger.Error("Error from access control system", "error", err)
				c.JsonApiErr(401, "Unauthorized", nil)
				return
			}
			if !hasAccess {
				c.Logger.Info("Access denied", "error", err, "permission", permission, "scopes", scopes)
				c.JsonApiErr(401, "Unauthorized", nil)
				return
			}
		}
	}
}

func init() {
	registry.Register(&registry.Descriptor{
		Name:     "fake-access-control",
		Instance: &FakeAccessControl{},
	})
}

var permissionMappings = map[string]struct {
	Scopes map[string]struct{}
	Role   models.RoleType
}{
	"users.view": {
		Scopes: map[string]struct{}{"users:self": {}},
		Role:   models.ROLE_VIEWER,
	},
	"users:tokens.list": {
		Scopes: map[string]struct{}{"users:self": {}},
		Role:   models.ROLE_VIEWER,
	},
}

type FakeAccessControl struct{}

func (f FakeAccessControl) Evaluate(ctx *models.ReqContext, user *models.SignedInUser, permission string, scopes ...string) (bool, error) {
	if user == nil {
		return false, nil
	}

	m, exists := permissionMappings[permission]
	if !exists {
		return false, nil
	}

	for _, scope := range scopes {
		if _, exists := m.Scopes[scope]; !exists {
			return false, nil
		}
	}

	if !user.OrgRole.Includes(m.Role) {
		return false, nil
	}

	return true, nil
}

func (f FakeAccessControl) Init() error {
	return nil
}
