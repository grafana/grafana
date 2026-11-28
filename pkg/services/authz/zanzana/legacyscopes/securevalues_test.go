package legacyscopes

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestResolvePermissionsSecureValueScopes(t *testing.T) {
	for _, action := range []string{"secret.securevalues:read", "secret.securevalues.permissions:read"} {
		for _, tc := range []struct {
			name string
			list *authzv1.ListResponse
			want string
		}{
			{"named", &authzv1.ListResponse{Items: []string{"personal-one"}}, "secret.securevalues:uid:personal-one"},
			{"wildcard", &authzv1.ListResponse{All: true}, "secret.securevalues:*"},
		} {
			t.Run(action+"/"+tc.name, func(t *testing.T) {
				entries := common.TranslateActionToListParams(action)
				require.Len(t, entries, 1)
				for _, filter := range []string{"", "secret.securevalues:uid:personal-one"} {
					permissions, err := ResolvePermissions(context.Background(), filter, []PermissionList{{
						Entry: entries[0], List: tc.list,
					}})
					require.NoError(t, err)
					require.Equal(t, []ac.Permission{{Action: action, Scope: tc.want}}, permissions)
				}
			})
		}
	}
}
