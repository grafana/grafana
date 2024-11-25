package server

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func testCapabilities(t *testing.T, server *Server) {
	newReq := func(subject, group, resource, folder, name string) *authzextv1.CapabilitiesRequest {
		return &authzextv1.CapabilitiesRequest{
			Namespace: namespace,
			Subject:   subject,
			Group:     group,
			Resource:  resource,
			Name:      name,
			Folder:    folder,
		}
	}

	t.Run("user:1 should only be able to read and write resource:dashboards.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:1", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead, common.RelationWrite}, res.GetCapabilities())
	})

	t.Run("user:2 should be able to read and write resource:dashboards.grafana.app/dashboards/1 through namespace", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:2", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead, common.RelationWrite}, res.GetCapabilities())
	})

	t.Run("user:3 should be able to read resource:dashboards.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:3", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead}, res.GetCapabilities())
	})

	t.Run("user:4 should be able to read dashboards.grafana.app/dashboards in folder 1", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:4", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead}, res.GetCapabilities())
	})

	t.Run("user:5 should be able to read, write, create and delete resource:dashboards.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:5", dashboardGroup, dashboardResource, "1", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead, common.RelationWrite, common.RelationCreate, common.RelationDelete}, res.GetCapabilities())
	})

	t.Run("user:6 should be able to read folder 1 ", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:6", folderGroup, folderResource, "", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead}, res.GetCapabilities())
	})

	t.Run("user:7 should be able to read folder one through namespace access", func(t *testing.T) {
		res, err := server.Capabilities(context.Background(), newReq("user:7", folderGroup, folderResource, "", "1"))
		require.NoError(t, err)
		assert.Equal(t, []string{common.RelationRead}, res.GetCapabilities())
	})
}
