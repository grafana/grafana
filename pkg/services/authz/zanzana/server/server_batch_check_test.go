package server

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func testBatchCheck(t *testing.T, server *Server) {
	newReq := func(subject, verb, group, resource, subresource string, items []*authzextv1.BatchCheckItem) *authzextv1.BatchCheckRequest {
		for i, item := range items {
			items[i] = &authzextv1.BatchCheckItem{
				Verb:        verb,
				Group:       group,
				Resource:    resource,
				Subresource: subresource,
				Name:        item.GetName(),
				Folder:      item.GetFolder(),
			}
		}

		return &authzextv1.BatchCheckRequest{
			Namespace: namespace,
			Subject:   subject,
			Items:     items,
		}
	}

	t.Run("user:1 should only be able to read resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:1", utils.VerbGet, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 2)

		assert.True(t, res.Groups[groupResource].Items["1"])
		assert.False(t, res.Groups[groupResource].Items["2"])
	})

	t.Run("user:2 should be able to read resource:dashboard.grafana.app/dashboards/{1,2} through group_resource", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:2", utils.VerbGet, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		assert.Len(t, res.Groups[groupResource].Items, 2)
	})

	t.Run("user:3 should be able to read resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:3", utils.VerbGet, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 2)

		assert.True(t, res.Groups[groupResource].Items["1"])
		assert.False(t, res.Groups[groupResource].Items["2"])
	})

	t.Run("user:4 should be able to read all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:4", utils.VerbGet, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "3"},
			{Name: "3", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 3)

		assert.True(t, res.Groups[groupResource].Items["1"])
		assert.True(t, res.Groups[groupResource].Items["2"])
		assert.False(t, res.Groups[groupResource].Items["3"])
	})

	t.Run("user:5 should be able to read resource:dashboard.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:5", utils.VerbGet, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 2)

		assert.True(t, res.Groups[groupResource].Items["1"])
		assert.False(t, res.Groups[groupResource].Items["2"])
	})

	t.Run("user:6 should be able to read folder 1", func(t *testing.T) {
		groupResource := common.FormatGroupResource(folderGroup, folderResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:6", utils.VerbGet, folderGroup, folderResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1"},
			{Name: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 2)

		assert.True(t, res.Groups[groupResource].Items["1"])
		assert.False(t, res.Groups[groupResource].Items["2"])
	})

	t.Run("user:7 should be able to read folder {1,2} through group_resource access", func(t *testing.T) {
		groupResource := common.FormatGroupResource(folderGroup, folderResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:7", utils.VerbGet, folderGroup, folderResource, "", []*authzextv1.BatchCheckItem{
			{Name: "1"},
			{Name: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 2)
		require.True(t, res.Groups[groupResource].Items["1"])
		require.True(t, res.Groups[groupResource].Items["2"])
	})

	t.Run("user:8 should be able to read all resoruce:dashboard.grafana.app/dashboards in folder 6 through folder 5", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:8", utils.VerbGet, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "10", Folder: "6"},
			{Name: "20", Folder: "6"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 2)
		require.True(t, res.Groups[groupResource].Items["10"])
		require.True(t, res.Groups[groupResource].Items["20"])
	})

	t.Run("user:9 should be able to create dashboards in folder 6 through folder 5", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, "")
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:9", utils.VerbCreate, dashboardGroup, dashboardResource, "", []*authzextv1.BatchCheckItem{
			{Name: "10", Folder: "6"},
			{Name: "20", Folder: "6"},
		}))
		require.NoError(t, err)
		t.Log(res.Groups)
		require.Len(t, res.Groups[groupResource].Items, 2)
		require.True(t, res.Groups[groupResource].Items["10"])
		require.True(t, res.Groups[groupResource].Items["20"])
	})

	t.Run("user:10 should be able to get dashboard status for 10 and 11", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, statusSubresource)
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:10", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, []*authzextv1.BatchCheckItem{
			{Name: "10", Folder: "6"},
			{Name: "11", Folder: "6"},
			{Name: "12", Folder: "6"},
		}))
		require.NoError(t, err)
		t.Log(res.Groups)
		require.Len(t, res.Groups[groupResource].Items, 3)
		require.True(t, res.Groups[groupResource].Items["10"])
		require.True(t, res.Groups[groupResource].Items["11"])
		require.False(t, res.Groups[groupResource].Items["12"])
	})

	t.Run("user:11 should be able to get dashboard status for 10, 11 and 12 through group_resource", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, statusSubresource)
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:11", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, []*authzextv1.BatchCheckItem{
			{Name: "10", Folder: "6"},
			{Name: "11", Folder: "6"},
			{Name: "12", Folder: "6"},
		}))
		require.NoError(t, err)
		t.Log(res.Groups)
		require.Len(t, res.Groups[groupResource].Items, 3)
		require.True(t, res.Groups[groupResource].Items["10"])
		require.True(t, res.Groups[groupResource].Items["11"])
		require.True(t, res.Groups[groupResource].Items["12"])
	})

	t.Run("user:12 should be able to get dashboard status in folder 5 and 6", func(t *testing.T) {
		groupResource := common.FormatGroupResource(dashboardGroup, dashboardResource, statusSubresource)
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:12", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, []*authzextv1.BatchCheckItem{
			{Name: "10", Folder: "5"},
			{Name: "11", Folder: "6"},
			{Name: "12", Folder: "6"},
			{Name: "13", Folder: "1"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupResource].Items, 4)
		require.True(t, res.Groups[groupResource].Items["10"])
		require.True(t, res.Groups[groupResource].Items["11"])
		require.True(t, res.Groups[groupResource].Items["12"])
		require.False(t, res.Groups[groupResource].Items["13"])
	})
}
