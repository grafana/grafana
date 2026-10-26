package resourcepermissions

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestSecureValueActionSets(t *testing.T) {
	svc := NewActionSetService()
	for level, actions := range map[string][]string{
		"view":  {"secret.securevalues:read"},
		"edit":  {"secret.securevalues:read", "secret.securevalues:write", "secret.securevalues:delete"},
		"admin": {"secret.securevalues:read", "secret.securevalues:write", "secret.securevalues:delete", "secret.securevalues.permissions:read", "secret.securevalues.permissions:write"},
	} {
		t.Run(level, func(t *testing.T) {
			set := "secret.securevalues:" + level
			require.ElementsMatch(t, actions, svc.ResolveActionSet(set))
			want := make([]accesscontrol.Permission, 0, len(actions))
			for _, action := range actions {
				want = append(want, accesscontrol.Permission{Action: action, Scope: "secret.securevalues:uid:personal-one"})
				require.Contains(t, svc.ResolveAction(action), set)
			}
			require.ElementsMatch(t, want, svc.ExpandActionSets([]accesscontrol.Permission{{Action: set, Scope: "secret.securevalues:uid:personal-one"}}))
		})
	}
}
