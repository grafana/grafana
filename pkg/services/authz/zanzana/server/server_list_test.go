package server

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func testList(t *testing.T, server *Server) {
	newList := func(subject, group, resource, subresource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{
			Namespace:   namespace,
			Verb:        utils.VerbList,
			Subject:     subject,
			Group:       group,
			Resource:    resource,
			Subresource: subresource,
		}
	}

	t.Run("user:1 should list resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:1", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:2 should be able to list all through group", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:2", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.True(t, res.GetAll())
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
	})

	t.Run("user:3 should be able to list resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:3", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)

		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:4 should be able to list all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:4", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "1")
		assert.Contains(t, res.GetFolders(), "3")
	})

	t.Run("user:5 should be list all dashboard.grafana.app/dashboards in folder 1 with set relation", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:5", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 1)
		assert.Equal(t, res.GetFolders()[0], "1")
	})

	t.Run("user:6 should be able to list folder 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:6", folderGroup, folderResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:7 should be able to list all folders", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:7", folderGroup, folderResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})

	t.Run("user:8 should be able to list resoruce:dashboard.grafana.app/dashboard in folder 6 and folder 5", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:8", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})

	t.Run("user:10 should be able to get resoruce:dashboard.grafana.app/dashboard/status for 10 and 11", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:10", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetFolders(), 0)
		assert.Len(t, res.GetItems(), 2)

		assert.Contains(t, res.GetItems(), "10")
		assert.Contains(t, res.GetItems(), "11")
	})

	t.Run("user:11 should be able to list all resoruce:dashboard.grafana.app/dashboard/status ", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:11", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})

	t.Run("user:12 should be able to list all resoruce:dashboard.grafana.app/dashboard/status in folder 5 and 6", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:12", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})
}
