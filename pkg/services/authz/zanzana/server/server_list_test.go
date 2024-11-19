package server

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func testList(t *testing.T, server *Server) {
	newList := func(subject, group, resource string) *authzextv1.ListRequest {
		return &authzextv1.ListRequest{
			Namespace: "default",
			Verb:      utils.VerbList,
			Subject:   subject,
			Group:     group,
			Resource:  resource,
		}
	}

	t.Run("user:1 should list resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:1", dashboardGroup, dashboardResource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:2 should be able to list all through group", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:2", dashboardGroup, dashboardResource))
		require.NoError(t, err)
		assert.True(t, res.GetAll())
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
	})

	t.Run("user:3 should be able to list resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:3", dashboardGroup, dashboardResource))
		require.NoError(t, err)

		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:4 should be able to list all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:4", dashboardGroup, dashboardResource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		first := res.GetFolders()[0]
		second := res.GetFolders()[1]

		if first == "3" {
			first, second = second, first
		}

		assert.Equal(t, first, "1")
		assert.Equal(t, second, "3")
	})

	t.Run("user:5 should be get list all dashboard.grafana.app/dashboards in folder 1 with set relation", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:5", dashboardGroup, dashboardResource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 1)
		assert.Equal(t, res.GetFolders()[0], "1")
	})

	t.Run("user:6 should be able to list folder 1", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:6", folderGroup, folderResource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:7 should be able to list all folders", func(t *testing.T) {
		res, err := server.List(context.Background(), newList("user:7", folderGroup, folderResource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})
}
