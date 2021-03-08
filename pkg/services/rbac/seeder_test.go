package rbac

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSeeder(t *testing.T) {
	mockTimeNow()
	t.Cleanup(resetTimeNow)

	ac := setupTestEnv(t)

	s := &seeder{
		Service: ac,
		log:     ac.log,
	}

	v1 := PolicyDTO{
		OrgId:   1,
		Name:    "grafana:tests:fake",
		Version: 1,
		Permissions: []Permission{
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:vanilla",
			},
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:chocolate",
			},
		},
	}
	v2 := PolicyDTO{
		OrgId:   1,
		Name:    "grafana:tests:fake",
		Version: 2,
		Permissions: []Permission{
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:vanilla",
			},
			{
				Permission: "ice_cream:serve",
				Scope:      "flavor:mint",
			},
			{
				Permission: "candy.liquorice:eat",
				Scope:      "",
			},
		},
	}

	t.Run("create policy", func(t *testing.T) {
		id, err := s.createOrUpdatePolicy(
			context.Background(),
			v1,
			nil,
		)
		require.NoError(t, err)
		assert.NotZero(t, id)

		p, err := s.Service.GetPolicy(context.Background(), 1, id)
		require.NoError(t, err)

		lookup := permissionMap(p.Permissions)
		assert.Contains(t, lookup, permissionTuple{
			Permission: "ice_cream:eat",
			Scope:      "flavor:vanilla",
		})
		assert.Contains(t, lookup, permissionTuple{
			Permission: "ice_cream:eat",
			Scope:      "flavor:chocolate",
		})

		policy := p.Policy()

		t.Run("update to same version", func(t *testing.T) {
			err := s.seed(context.Background(), 1, []PolicyDTO{v1}, nil)
			require.NoError(t, err)
		})
		t.Run("update to new policy version", func(t *testing.T) {
			err := s.seed(context.Background(), 1, []PolicyDTO{v2}, nil)
			require.NoError(t, err)

			p, err := s.Service.GetPolicy(context.Background(), 1, policy.Id)
			require.NoError(t, err)
			assert.Len(t, p.Permissions, len(v2.Permissions))

			lookup := permissionMap(p.Permissions)
			assert.Contains(t, lookup, permissionTuple{
				Permission: "candy.liquorice:eat",
				Scope:      "",
			})
			assert.NotContains(t, lookup, permissionTuple{
				Permission: "ice_cream:eat",
				Scope:      "flavor:chocolate",
			})
		})
	})
}
