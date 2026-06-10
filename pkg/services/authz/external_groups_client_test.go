package authz

import (
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

func TestExternalGroupsAccessClient_swap(t *testing.T) {
	c := &externalGroupsAccessClient{}

	t.Run("user with external groups: GetGroups returns external groups", func(t *testing.T) {
		base := &identity.StaticRequester{
			Type:           claims.TypeUser,
			Groups:         []string{"stored-team"},
			ExternalGroups: []string{"admins-editors", "editors-viewers"},
		}
		got := c.swap(base)
		assert.Equal(t, []string{"admins-editors", "editors-viewers"}, got.GetGroups())
		// other AuthInfo methods still delegate
		assert.Equal(t, base.GetUID(), got.GetUID())
	})

	t.Run("no external groups: original is returned untouched", func(t *testing.T) {
		base := &identity.StaticRequester{
			Type:           claims.TypeUser,
			Groups:         []string{"stored-team"},
			ExternalGroups: nil,
		}
		got := c.swap(base)
		assert.Equal(t, []string{"stored-team"}, got.GetGroups())
	})
}

func TestNewExternalGroupsAccessClient_flagGating(t *testing.T) {
	inner := &externalGroupsAccessClient{} // any AccessClient; only identity matters

	t.Run("flag off: returns inner unchanged", func(t *testing.T) {
		got := newExternalGroupsAccessClient(&setting.Cfg{IDUseExternalGroupsForGroupsClaim: false}, inner)
		assert.Same(t, inner, got)
	})

	t.Run("flag on: returns decorator", func(t *testing.T) {
		got := newExternalGroupsAccessClient(&setting.Cfg{IDUseExternalGroupsForGroupsClaim: true}, inner)
		assert.NotSame(t, inner, got)
	})
}
