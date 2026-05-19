package server

import (
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

	t.Run("render service gets dashboard and folder contextual tuples", func(t *testing.T) {
		contextuals, err := srv.getContextuals("render:0")
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

	t.Run("non-render subject returns nil contextuals", func(t *testing.T) {
		contextuals, err := srv.getContextuals("user:123")
		require.NoError(t, err)
		assert.Nil(t, contextuals)
	})
}
