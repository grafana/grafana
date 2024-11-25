package server

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func testBatchCheck(t *testing.T, server *Server) {
	newReq := func(subject, group, resource string, items []*authzextv1.BatchCheckItem) *authzextv1.BatchCheckRequest {
		for i, item := range items {
			items[i] = &authzextv1.BatchCheckItem{
				Verb:     utils.VerbGet,
				Group:    group,
				Resource: resource,
				Name:     item.GetName(),
				Folder:   item.GetFolder(),
			}
		}

		return &authzextv1.BatchCheckRequest{
			Namespace: namespace,
			Subject:   subject,
			Items:     items,
		}
	}

	t.Run("user:1 should only be able to read resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(dashboardGroup, dashboardResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:1", dashboardGroup, dashboardResource, []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupPrefix].Items, 2)

		assert.True(t, res.Groups[groupPrefix].Items["1"])
		assert.False(t, res.Groups[groupPrefix].Items["2"])
	})

	t.Run("user:2 should be able to read resource:dashboard.grafana.app/dashboards/{1,2} through namespace", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(dashboardGroup, dashboardResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:2", dashboardGroup, dashboardResource, []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		assert.Len(t, res.Groups[groupPrefix].Items, 2)
	})

	t.Run("user:3 should be able to read resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(dashboardGroup, dashboardResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:3", dashboardGroup, dashboardResource, []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupPrefix].Items, 2)

		assert.True(t, res.Groups[groupPrefix].Items["1"])
		assert.False(t, res.Groups[groupPrefix].Items["2"])
	})

	t.Run("user:4 should be able to read all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(dashboardGroup, dashboardResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:4", dashboardGroup, dashboardResource, []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "3"},
			{Name: "3", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupPrefix].Items, 3)

		assert.True(t, res.Groups[groupPrefix].Items["1"])
		assert.True(t, res.Groups[groupPrefix].Items["2"])
		assert.False(t, res.Groups[groupPrefix].Items["3"])
	})

	t.Run("user:5 should be able to read resource:dashboard.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(dashboardGroup, dashboardResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:5", dashboardGroup, dashboardResource, []*authzextv1.BatchCheckItem{
			{Name: "1", Folder: "1"},
			{Name: "2", Folder: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupPrefix].Items, 2)

		assert.True(t, res.Groups[groupPrefix].Items["1"])
		assert.False(t, res.Groups[groupPrefix].Items["2"])
	})

	t.Run("user:6 should be able to read folder 1", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(folderGroup, folderResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:6", folderGroup, folderResource, []*authzextv1.BatchCheckItem{
			{Name: "1"},
			{Name: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupPrefix].Items, 2)

		assert.True(t, res.Groups[groupPrefix].Items["1"])
		assert.False(t, res.Groups[groupPrefix].Items["2"])
	})

	t.Run("user:7 should be able to read folder {1,2} through namespace access", func(t *testing.T) {
		groupPrefix := zanzana.FormatGroupResource(folderGroup, folderResource)
		res, err := server.BatchCheck(context.Background(), newReq("user:7", folderGroup, folderResource, []*authzextv1.BatchCheckItem{
			{Name: "1"},
			{Name: "2"},
		}))
		require.NoError(t, err)
		require.Len(t, res.Groups[groupPrefix].Items, 2)
	})
}
