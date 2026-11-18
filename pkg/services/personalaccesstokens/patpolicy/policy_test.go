package patpolicy

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/setting"
)

type revokeStore struct {
	patstore.Store
	allReason, orgReason string
	orgID                int64
}

func (s *revokeStore) RevokeAll(_ context.Context, reason string) (int64, error) {
	s.allReason = reason
	return 3, nil
}

func (s *revokeStore) RevokeAllInOrg(_ context.Context, orgID int64, reason string) (int64, error) {
	s.orgID, s.orgReason = orgID, reason
	return 2, nil
}

func newSvc(enabled, override bool) (*Service, *revokeStore) {
	cfg := setting.NewCfg()
	cfg.PersonalAccessTokens.Enabled = enabled
	cfg.PersonalAccessTokens.AllowRuntimeOverride = override
	st := &revokeStore{}
	return ProvideService(kvstore.NewFakeKVStore(), st, cfg), st
}

func TestPolicy(t *testing.T) {
	ctx := context.Background()
	actor := Actor{UserID: 1, OrgID: 1}

	t.Run("config default applies until overridden", func(t *testing.T) {
		s, _ := newSvc(false, true)
		require.False(t, s.InstanceEnabled(ctx))
		_, err := s.SetInstance(ctx, actor, true, false)
		require.NoError(t, err)
		require.True(t, s.InstanceEnabled(ctx))
		require.True(t, s.OrgEnabled(ctx, 5))
	})

	t.Run("org switch can only narrow", func(t *testing.T) {
		s, _ := newSvc(true, true)
		_, err := s.SetOrg(ctx, actor, 5, false, false)
		require.NoError(t, err)
		require.False(t, s.OrgEnabled(ctx, 5))
		require.True(t, s.OrgEnabled(ctx, 6))

		_, err = s.SetInstance(ctx, actor, false, false)
		require.NoError(t, err)
		_, err = s.SetOrg(ctx, actor, 6, true, false)
		require.NoError(t, err)
		require.False(t, s.OrgEnabled(ctx, 6), "org cannot enable what the instance disabled")
	})

	t.Run("revoke existing uses admin_policy only when disabling", func(t *testing.T) {
		s, st := newSvc(true, true)
		n, err := s.SetInstance(ctx, actor, true, true)
		require.NoError(t, err)
		require.Zero(t, n)
		require.Empty(t, st.allReason)

		n, err = s.SetOrg(ctx, actor, 5, false, true)
		require.NoError(t, err)
		require.Equal(t, int64(2), n)
		require.Equal(t, patstore.ReasonAdminPolicy, st.orgReason)
		require.Equal(t, int64(5), st.orgID)

		n, err = s.SetInstance(ctx, actor, false, true)
		require.NoError(t, err)
		require.Equal(t, int64(3), n)
		require.Equal(t, patstore.ReasonAdminPolicy, st.allReason)
	})

	t.Run("config-managed switch is read-only", func(t *testing.T) {
		s, _ := newSvc(true, false)
		_, err := s.SetInstance(ctx, actor, false, false)
		require.ErrorIs(t, err, ErrManagedByConfig)
		require.True(t, s.InstanceEnabled(ctx))
		st, err := s.GetInstance(ctx)
		require.NoError(t, err)
		require.True(t, st.ManagedByConfig)
	})
}
