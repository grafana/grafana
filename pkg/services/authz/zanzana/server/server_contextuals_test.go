package server

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestGetContextuals(t *testing.T) {
	srv := &Server{}

	t.Run("render service gets dashboard and folder contextual base tuples", func(t *testing.T) {
		contextuals, err := srv.getContextuals(t.Context(), "render:0")
		require.NoError(t, err)
		require.NotNil(t, contextuals)
		require.Len(t, contextuals.TupleKeys, 3)

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

		for i, tuple := range contextuals.TupleKeys {
			assert.Equal(t, "render:0", tuple.User)
			assert.Equal(t, common.RelationSetView, tuple.Relation)
			assert.Equal(t, expectedObjects[i], tuple.Object)
		}
	})

	t.Run("non-render subject without groups returns no tuples", func(t *testing.T) {
		contextuals, err := srv.getContextuals(t.Context(), "user:123")
		require.NoError(t, err)
		assert.Nil(t, contextuals)
	})

	t.Run("auth info groups add team member tuples", func(t *testing.T) {
		ctx := newContextWithGroups("aa", "bb")
		contextuals, err := srv.getContextuals(ctx, "user:1")
		require.NoError(t, err)
		require.NotNil(t, contextuals)
		require.Len(t, contextuals.TupleKeys, 2)
		assert.Equal(t, "user:1", contextuals.TupleKeys[0].User)
		assert.Equal(t, "user:1", contextuals.TupleKeys[1].User)
		assert.Equal(t, common.RelationTeamMember, contextuals.TupleKeys[0].Relation)
		assert.Equal(t, common.NewTypedIdent(common.TypeTeam, "aa"), contextuals.TupleKeys[0].Object)
		assert.Equal(t, common.NewTypedIdent(common.TypeTeam, "bb"), contextuals.TupleKeys[1].Object)
	})

	t.Run("auth info groups support one thousand teams", func(t *testing.T) {
		groups := make([]string, 1000)
		for i := range groups {
			groups[i] = fmt.Sprintf("team-%04d", i)
		}

		ctx := newContextWithGroups(groups...)
		contextuals, err := srv.getContextuals(ctx, "user:1")
		require.NoError(t, err)
		require.NotNil(t, contextuals)
		require.Len(t, contextuals.TupleKeys, len(groups))

		seen := make(map[string]struct{}, len(contextuals.TupleKeys))
		for _, tuple := range contextuals.TupleKeys {
			assert.Equal(t, "user:1", tuple.User)
			assert.Equal(t, common.RelationTeamMember, tuple.Relation)
			seen[tuple.Object] = struct{}{}
		}

		for _, group := range groups {
			assert.Contains(t, seen, common.NewTypedIdent(common.TypeTeam, group))
		}
	})
}
