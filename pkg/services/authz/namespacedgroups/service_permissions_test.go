package namespacedgroups

import (
	"testing"

	"github.com/stretchr/testify/assert"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestCheckServicePermissions(t *testing.T) {
	const group = "myapp.stacks-1.gas.ext.grafana.app"
	service := func(permissions ...string) claims.AuthInfo {
		return &identity.StaticRequester{
			Type: claims.TypeAccessPolicy, Namespace: "stacks-1",
			AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
				Rest: authnlib.AccessTokenClaims{Permissions: permissions},
			},
		}
	}
	user := func(delegated ...string) claims.AuthInfo {
		return &identity.StaticRequester{
			Type: claims.TypeUser, UserID: 1, Namespace: "stacks-1",
			AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
				Rest: authnlib.AccessTokenClaims{DelegatedPermissions: delegated},
			},
		}
	}
	for name, tc := range map[string]struct {
		id                claims.AuthInfo
		namespace, group  string
		allowed, viaOwner bool
	}{
		"owner group":               {id: service("gas.ext.grafana.app:*"), allowed: true, viaOwner: true},
		"owner group, the verb":     {id: service("gas.ext.grafana.app:create"), allowed: true, viaOwner: true},
		"owner group, another verb": {id: service("gas.ext.grafana.app:get")},
		"plugin group wildcard":     {id: service("*.ext.grafana.app:*"), allowed: true, viaOwner: true},
		"delegated wildcard":        {id: user("*.ext.grafana.app:*"), allowed: true, viaOwner: true},
		"the group itself":          {id: service(group + ":*"), allowed: true},
		"owner resource":            {id: service("gas.ext.grafana.app/books:*")},
		"another owner":             {id: service("other.ext.grafana.app:*")},
		"no permissions":            {id: service()},
		"another namespace":         {id: service("gas.ext.grafana.app:*"), namespace: "stacks-2"},
		"wildcard namespace":        {id: service("gas.ext.grafana.app:*"), namespace: "*"},
		"no namespace":              {id: service("gas.ext.grafana.app:*"), namespace: "-"},
		"plugin group":              {id: service("gas.ext.grafana.app:*"), group: "gas.ext.grafana.app", allowed: true},
	} {
		t.Run(name, func(t *testing.T) {
			namespace, g := "stacks-1", group
			switch tc.namespace {
			case "":
			case "-":
				namespace = ""
			default:
				namespace = tc.namespace
			}
			if tc.group != "" {
				g = tc.group
			}
			res, viaOwner := CheckServicePermissions(tc.id, namespace, g, "books", "create")
			assert.Equal(t, tc.allowed, res.Allowed)
			assert.Equal(t, tc.viaOwner, viaOwner)
		})
	}
}
