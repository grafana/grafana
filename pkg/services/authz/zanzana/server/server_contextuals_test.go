package server

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// testFeatureToggles is a minimal [featuremgmt.FeatureToggles] for unit tests.
type testFeatureToggles struct {
	enabled map[string]bool
}

func (t *testFeatureToggles) IsEnabled(_ context.Context, flag string) bool {
	if t == nil || t.enabled == nil {
		return false
	}
	return t.enabled[flag]
}

func (t *testFeatureToggles) IsEnabledGlobally(flag string) bool {
	if t == nil || t.enabled == nil {
		return false
	}
	return t.enabled[flag]
}

func (t *testFeatureToggles) GetEnabled(_ context.Context) map[string]bool {
	if t == nil {
		return nil
	}
	return t.enabled
}

func TestGetContextualParts(t *testing.T) {
	srv := &Server{}

	t.Run("render service gets dashboard and folder contextual base tuples", func(t *testing.T) {
		base, team, err := srv.getContextualParts(t.Context(), "render:0")
		require.NoError(t, err)
		require.NotNil(t, base)
		require.Nil(t, team)
		require.Len(t, base.TupleKeys, 3)

		expectedObjects := []string{
			common.NewGroupResourceIdent(
				dashboardV2alpha1.DashboardResourceInfo.GroupResource().Group,
				dashboardV2alpha1.DashboardResourceInfo.GroupResource().Resource,
				"",
			),
			common.NewGroupResourceIdent(
				dashboardV2beta1.DashboardResourceInfo.GroupResource().Group,
				dashboardV2beta1.DashboardResourceInfo.GroupResource().Resource,
				"",
			),
			common.NewGroupResourceIdent(
				folders.FolderResourceInfo.GroupResource().Group,
				folders.FolderResourceInfo.GroupResource().Resource,
				"",
			),
		}

		for i, tuple := range base.TupleKeys {
			assert.Equal(t, "render:0", tuple.User)
			assert.Equal(t, common.RelationSetView, tuple.Relation)
			assert.Equal(t, expectedObjects[i], tuple.Object)
		}
	})

	t.Run("non-render subject with feature off returns no tuples", func(t *testing.T) {
		base, team, err := srv.getContextualParts(t.Context(), "user:123")
		require.NoError(t, err)
		assert.Nil(t, base)
		assert.Nil(t, team)
	})

	t.Run("ContextWithTeams adds team member tuples when feature is on", func(t *testing.T) {
		s := &Server{
			cfg: setting.ZanzanaServerSettings{ContextualTeamsChunkSize: 25},
			features: &testFeatureToggles{enabled: map[string]bool{
				featuremgmt.FlagZanzanaContextualTeams: true,
			}},
		}
		ctx := common.ContextWithTeams(t.Context(), []string{"team:aa", "team:bb"})
		base, team, err := s.getContextualParts(ctx, "user:1")
		require.NoError(t, err)
		assert.Nil(t, base)
		require.Len(t, team, 2)
		assert.Equal(t, "user:1", team[0].User)
		assert.Equal(t, "user:1", team[1].User)
		assert.Equal(t, common.RelationTeamMember, team[0].Relation)
		assert.Equal(t, common.NewTypedIdent(common.TypeTeam, "aa"), team[0].Object)
		assert.Equal(t, common.NewTypedIdent(common.TypeTeam, "bb"), team[1].Object)
	})
}
