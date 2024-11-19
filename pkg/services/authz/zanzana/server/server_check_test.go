package server

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func testCheck(t *testing.T, server *Server) {
	newRead := func(subject, group, resource, folder, name string) *authzv1.CheckRequest {
		return &authzv1.CheckRequest{
			Namespace: "default",
			Subject:   subject,
			Verb:      utils.VerbGet,
			Group:     group,
			Resource:  resource,
			Name:      name,
			Folder:    folder,
		}
	}

	t.Run("user:1 should only be able to read resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:1", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newRead("user:1", dashboardGroup, dashboardResource, "1", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:2 should be able to read resource:dashboard.grafana.app/dashboards/1 through namespace", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:2", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:3 should be able to read resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:3", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newRead("user:3", dashboardGroup, dashboardResource, "1", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:4 should be able to read all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:4", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newRead("user:4", dashboardGroup, dashboardResource, "3", "2"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newRead("user:4", dashboardGroup, dashboardResource, "1", "2"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newRead("user:4", dashboardGroup, dashboardResource, "2", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:5 should be able to read resource:dashboard.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:5", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:6 should be able to read folder 1 ", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:6", folderGroup, folderResource, "", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:7 should be able to read folder one through namespace access", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:7", folderGroup, folderResource, "", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newRead("user:7", folderGroup, folderResource, "", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:8 should be able to read all resoruce:dashboard.grafana.app/dashboar in folder 6 through folder 5", func(t *testing.T) {
		res, err := server.Check(context.Background(), newRead("user:8", dashboardGroup, dashboardResource, "6", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newRead("user:8", dashboardGroup, dashboardResource, "5", "11"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newRead("user:8", folderGroup, folderResource, "4", "12"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})
}
