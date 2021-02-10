package rbac

import (
	"bytes"
	"context"
	"net/http"
	"text/template"

	"github.com/gobwas/glob"

	"github.com/grafana/grafana/pkg/registry"
	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/models"
)

type AccessControl interface {
	// Evaluate evaluates access to the given resource
	Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error)
}

func Middleware(ac AccessControl) func(string, ...string) macaron.Handler {
	return func(permission string, scopes ...string) macaron.Handler {
		return func(c *models.ReqContext) {
			for i, scope := range scopes {
				var buf bytes.Buffer

				tmpl, err := template.New("scope").Parse(scope)
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
				}
				err = tmpl.Execute(&buf, c.AllParams())
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "Internal server error", err)
				}
				scopes[i] = buf.String()
			}

			hasAccess, err := ac.Evaluate(context.TODO(), c.SignedInUser, permission, scopes...)
			if err != nil {
				c.Logger.Error("Error from access control system", "error", err)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
				return
			}
			if !hasAccess {
				c.Logger.Info("Access denied", "error", err, "userID", c.UserId, "permission", permission, "scopes", scopes)
				c.JsonApiErr(http.StatusForbidden, "Forbidden", nil)
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
	Scopes []string
	Role   models.RoleType
}{
	"users:read": {
		Scopes: []string{"users:self"},
		Role:   models.ROLE_VIEWER,
	},
	"users.tokens:list": {
		Scopes: []string{"users:self"},
		Role:   models.ROLE_VIEWER,
	},
	"users.teams:read": {
		Scopes: []string{"users:*"},
		Role:   models.ROLE_VIEWER,
	},
	"orgs:list": {
		Role: models.ROLE_VIEWER,
	},
	"orgs:switch": {
		Scopes: []string{"orgs:*"},
		Role:   models.ROLE_VIEWER,
	},
}

type FakeAccessControl struct{}

func (f FakeAccessControl) Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scopes ...string) (bool, error) {
	if user == nil {
		return false, nil
	}

	m, exists := permissionMappings[permission]
	if !exists {
		return false, nil
	}

	if !user.OrgRole.Includes(m.Role) {
		return false, nil
	}

	for _, scope := range scopes {
		var match bool
		for _, s := range m.Scopes {
			rule, err := glob.Compile(s, ':', '/')
			if err != nil {
				return false, err
			}

			match = rule.Match(scope)
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

func (f FakeAccessControl) Init() error {
	return nil
}
