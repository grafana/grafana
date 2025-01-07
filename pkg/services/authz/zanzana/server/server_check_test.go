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
	newReq := func(subject, verb, group, resource, subresource, folder, name string) *authzv1.CheckRequest {
		return &authzv1.CheckRequest{
			Namespace:   namespace,
			Subject:     subject,
			Verb:        verb,
			Group:       group,
			Resource:    resource,
			Subresource: subresource,
			Name:        name,
			Folder:      folder,
		}
	}

	t.Run("user:1 should only be able to read resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newReq("user:1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())

		// sanity check no access to subresource
		res, err = server.Check(context.Background(), newReq("user:1", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "1", "1"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:2 should be able to read resource:dashboard.grafana.app/dashboards/1 through group_resource", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:2", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:3 should be able to read resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:3", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newReq("user:3", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:4 should be able to read all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:4", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:4", utils.VerbGet, dashboardGroup, dashboardResource, "", "3", "2"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// sanity check
		res, err = server.Check(context.Background(), newReq("user:4", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "2"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:4", utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:5 should be able to read resource:dashboard.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:5", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:6 should be able to read folder 1 ", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:6", utils.VerbGet, folderGroup, folderResource, "", "", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:7 should be able to read folder one through group_resource access", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:7", utils.VerbGet, folderGroup, folderResource, "", "", "1"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:7", utils.VerbGet, folderGroup, folderResource, "", "", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:8 should be able to read all resoruce:dashboard.grafana.app/dashboar in folder 6 through folder 5", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:8", utils.VerbGet, dashboardGroup, dashboardResource, "", "6", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:8", utils.VerbGet, dashboardGroup, dashboardResource, "", "5", "11"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:8", utils.VerbGet, folderGroup, folderResource, "", "4", "12"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:9 should be able to create dashboards in folder 5", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:9", utils.VerbCreate, dashboardGroup, dashboardResource, "", "5", ""))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:10 should be able to read dashboard status for dashboard 10", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:10", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:10", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "1"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("user:11 should be able to read dashboard status for dashboard 10 through group_resource", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:11", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})

	t.Run("user:12 should be able to read dashboard status for all dashboards in folder 5", func(t *testing.T) {
		res, err := server.Check(context.Background(), newReq("user:12", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "5", "10"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:12", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "5", "11"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		// inherited from folder 5
		res, err = server.Check(context.Background(), newReq("user:12", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "12"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())

		res, err = server.Check(context.Background(), newReq("user:12", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "1", "13"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})
}
