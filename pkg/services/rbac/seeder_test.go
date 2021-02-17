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
		OrgId:       1,
		Name:        "grafana:tests:fake",
		Description: "v1",
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
		OrgId:       1,
		Name:        "grafana:tests:fake",
		Description: "v2",
		Permissions: []Permission{
			{
				Permission: "ice_cream:eat",
				Scope:      "flavor:vanilla",
			},
			{
				Permission: "ice_cream:serve",
				Scope:      "flavor:mint",
			},
		},
	}
	var policy Policy

	created := t.Run("create policy", func(t *testing.T) {
		// Return <id, nil> when creating the policy.
		id, err := s.createOrUpdatePolicy(
			context.Background(),
			v1,
			nil,
		)
		require.NoError(t, err)
		assert.NotZero(t, id)

		err = s.idempotentUpdatePermissions(context.Background(), id,
			v1.Permissions,
			nil,
		)
		require.NoError(t, err)

		p, err := s.Service.GetPolicy(context.Background(), 1, id)
		require.NoError(t, err)
		policy = p.Policy()
	})
	require.True(t, created)

	t.Run("update to same version", func(t *testing.T) {
		// Return <0, nil> when trying to deploy the same or an older generation of the policy.
		ran, err := s.seed(context.Background(), 1, []PolicyDTO{v1})
		require.NoError(t, err)
		assert.False(t, ran)
	})
	t.Run("update to new policy version", func(t *testing.T) {
		// Return <id, nil> when updating with a newer version.
		ran, err := s.seed(context.Background(), 1, []PolicyDTO{v2})
		require.NoError(t, err)
		assert.True(t, ran)

		p, err := s.Service.GetPolicy(context.Background(), 1, policy.Id)
		require.NoError(t, err)
		assert.Len(t, p.Permissions, len(v2.Permissions))
	})
}
