package legacypermissions

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestListPermissionsSecureValueScopes(t *testing.T) {
	for _, action := range []string{
		"secret.securevalues:read",
		"secret.securevalues:write",
		"secret.securevalues:delete",
		"secret.securevalues:create",
		"secret.securevalues.permissions:read",
		"secret.securevalues.permissions:write",
	} {
		for _, tc := range []struct {
			name     string
			response *authzv1.ListResponse
			scope    string
		}{
			{"named", &authzv1.ListResponse{Items: []string{"personal-one"}}, "secret.securevalues:uid:personal-one"},
			{"wildcard", &authzv1.ListResponse{All: true}, "secret.securevalues:*"},
		} {
			t.Run(action+"/"+tc.name, func(t *testing.T) {
				for _, filter := range []string{"", "secret.securevalues:uid:personal-one"} {
					perms, err := zanzanaResolve(tc.response, action, filter)
					require.NoError(t, err)
					require.Equal(t, []ac.Permission{{Action: action, Scope: tc.scope}}, perms)
				}
			})
		}
	}
}
