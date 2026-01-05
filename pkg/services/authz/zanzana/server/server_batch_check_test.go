package server

import (
	"fmt"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func testBatchCheck(t *testing.T, server *Server) {
	// Helper to create a batch check request
	newReq := func(subject string, items []*authzv1.BatchCheckItem) *authzv1.BatchCheckRequest {
		return &authzv1.BatchCheckRequest{
			Subject:   subject,
			Namespace: namespace,
			Checks:    items,
		}
	}

	// Helper to create a batch check item with correlation ID
	newItem := func(verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
		correlationID := fmt.Sprintf("%s-%s-%s-%s", group, resource, folder, name)
		return &authzv1.BatchCheckItem{
			Verb:          verb,
			Group:         group,
			Resource:      resource,
			Subresource:   subresource,
			Name:          name,
			Folder:        folder,
			CorrelationId: correlationID,
		}
	}

	t.Run("user:1 should only be able to read resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:1", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "2", "2")].Allowed)
	})

	t.Run("user:2 should be able to read resource:dashboard.grafana.app/dashboards/{1,2} through group_resource", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:2", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		// user:2 has group_resource access, so both should be allowed
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "2", "2")].Allowed)
	})

	t.Run("user:3 should be able to read resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:3", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "2", "2")].Allowed)
	})

	t.Run("user:4 should be able to read all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:4", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "3", "2"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "3"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 3)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "3", "2")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "2", "3")].Allowed)
	})

	t.Run("user:5 should be able to read resource:dashboard.grafana.app/dashboards/1 through folder with set relation", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:5", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "2", "2")].Allowed)
	})

	t.Run("user:6 should be able to read folder 1", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:6", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, folderGroup, folderResource, "", "", "1"),
			newItem(utils.VerbGet, folderGroup, folderResource, "", "", "2"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", folderGroup, folderResource, "", "1")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", folderGroup, folderResource, "", "2")].Allowed)
	})

	t.Run("user:7 should be able to read folder {1,2} through group_resource access", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:7", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, folderGroup, folderResource, "", "", "1"),
			newItem(utils.VerbGet, folderGroup, folderResource, "", "", "2"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", folderGroup, folderResource, "", "1")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", folderGroup, folderResource, "", "2")].Allowed)
	})

	t.Run("user:8 should be able to read all resource:dashboard.grafana.app/dashboards in folder 6 through folder 5", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:8", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "6", "10"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "6", "20"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "10")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "20")].Allowed)
	})

	t.Run("user:9 should be able to create dashboards in folder 6 through folder 5", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:9", []*authzv1.BatchCheckItem{
			newItem(utils.VerbCreate, dashboardGroup, dashboardResource, "", "6", "10"),
			newItem(utils.VerbCreate, dashboardGroup, dashboardResource, "", "6", "20"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "10")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "20")].Allowed)
	})

	t.Run("user:10 should be able to get dashboard status for 10 and 11", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:10", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "10"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "11"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "12"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 3)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "10")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "11")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "12")].Allowed)
	})

	t.Run("user:11 should be able to get dashboard status for 10, 11 and 12 through group_resource", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:11", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "10"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "11"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "12"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 3)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "10")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "11")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "12")].Allowed)
	})

	t.Run("user:12 should be able to get dashboard status in folder 5 and 6", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newReq("user:12", []*authzv1.BatchCheckItem{
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "5", "10"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "11"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "6", "12"),
			newItem(utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "1", "13"),
		}))
		require.NoError(t, err)
		require.Len(t, res.Results, 4)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "5", "10")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "11")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "6", "12")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "13")].Allowed)
	})
}
