package roleauth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBindingSelectors(t *testing.T) {
	for _, tc := range []struct {
		name, verb         string
		users, teams, want bool
	}{
		{"user-abc", "update", true, false, true}, {"serviceaccount-abc", "delete", true, false, true},
		{"team-abc", "update", true, false, false}, {"user-abc", "update", false, true, false}, {"team-*", "create", false, true, true},
		{"user-*", "update", true, false, true}, {"serviceaccount-*", "update", true, false, true},
		{"", "create", false, true, true}, {"", "update", true, false, false}, {"*", "create", true, false, false},
		{"*", "deletecollection", true, true, true}, {"garbage", "update", true, true, false},
		{"user-", "delete", true, true, false}, {"user-?", "update", true, true, false}, {"team-[ab]", "update", true, true, false}, {"user-a*", "create", true, true, false}, {"team-*/x", "update", true, true, false},
	} {
		t.Run(tc.name+"/"+tc.verb, func(t *testing.T) {
			got, err := CheckBinding(tc.name, tc.verb, func(f string) (bool, error) {
				if f == "users" {
					return tc.users, nil
				}
				return tc.teams, nil
			})
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}
func TestDelegationChecks(t *testing.T) {
	for action, n := range map[string]int{"roles:write": 2, "roles:delete": 1, "users.roles:add": 4, "users.roles:remove": 2, "teams.roles:add": 2, "teams.roles:remove": 1} {
		checks, ok := DelegationChecks(action, "permissions:type:delegate")
		require.True(t, ok)
		require.Len(t, checks, n)
		for _, check := range checks {
			require.Equal(t, Group, check.Group)
			require.NotEmpty(t, check.Name)
		}
		_, ok = DelegationChecks(action, "permissions:type:escalate")
		require.False(t, ok)
	}
}
