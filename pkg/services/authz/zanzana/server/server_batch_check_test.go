package server

import (
	"fmt"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationServerBatchCheck(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)

	newBatchReq := func(subject string, items []*authzv1.BatchCheckItem) *authzv1.BatchCheckRequest {
		return &authzv1.BatchCheckRequest{
			Namespace: namespace,
			Subject:   subject,
			Checks:    items,
		}
	}

	newItem := func(correlationID, verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
		return &authzv1.BatchCheckItem{
			CorrelationId: correlationID,
			Verb:          verb,
			Group:         group,
			Resource:      resource,
			Subresource:   subresource,
			Name:          name,
			Folder:        folder,
		}
	}

	t.Run("empty batch should return empty results", func(t *testing.T) {
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:1", []*authzv1.BatchCheckItem{}))
		require.NoError(t, err)
		assert.Len(t, res.GetResults(), 0)
	})

	t.Run("single item batch check", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:1", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 1)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
	})

	t.Run("multiple items with mixed permissions", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"), // user:1 has access
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "2"), // user:1 does not have access
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:1", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.False(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("user:2 should have access through group_resource", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "2"),
			newItem("check3", utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "3"),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:2", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 3)
		// user:2 has group_resource access to all dashboards
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
		assert.True(t, res.GetResults()["check3"].GetAllowed())
	})

	t.Run("user:3 should have access with set relation", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"), // has access via set relation
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "2"), // no access
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:3", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.False(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("user:4 should have folder-based access", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"), // folder 1 access
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, "", "3", "2"), // folder 3 access
			newItem("check3", utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "3"), // no access to folder 2
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:4", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 3)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
		assert.False(t, res.GetResults()["check3"].GetAllowed())
	})

	t.Run("folder access check", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, folderGroup, folderResource, "", "", "1"), // user:6 has direct access
			newItem("check2", utils.VerbGet, folderGroup, folderResource, "", "", "2"), // no access
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:6", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.False(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("user:7 should have access to all folders through group_resource", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, folderGroup, folderResource, "", "", "1"),
			newItem("check2", utils.VerbGet, folderGroup, folderResource, "", "", "10"),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:7", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("user:8 should have inherited folder access", func(t *testing.T) {
		// folder hierarchy: folder-4 -> folder-5 -> folder-6
		// user:8 has access to folder 5
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "6", "10"), // access through folder 5
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, "", "5", "11"), // direct folder 5 access
			newItem("check3", utils.VerbGet, folderGroup, folderResource, "", "4", "12"),       // no access to folder 4
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:8", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 3)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
		assert.False(t, res.GetResults()["check3"].GetAllowed())
	})

	t.Run("create permissions check", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbCreate, dashboardGroup, dashboardResource, "", "5", ""),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:9", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 1)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
	})

	t.Run("subresource permissions check", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "10"), // has access
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "1"),  // no access
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:10", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.False(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("user:11 should have group_resource access to subresources", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "10"),
			newItem("check2", utils.VerbGet, dashboardGroup, dashboardResource, statusSubresource, "", "999"),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:11", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("user:17 should have access to folder hierarchy", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, folderGroup, folderResource, "", "", "4"),
			newItem("check2", utils.VerbGet, folderGroup, folderResource, "", "", "5"),
			newItem("check3", utils.VerbGet, folderGroup, folderResource, "", "", "6"),
			newItem("check4", utils.VerbGet, dashboardGroup, dashboardResource, "", "4", "1"),
			newItem("check5", utils.VerbGet, dashboardGroup, dashboardResource, "", "5", "1"),
			newItem("check6", utils.VerbGet, dashboardGroup, dashboardResource, "", "6", "1"),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:17", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 6)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
		assert.True(t, res.GetResults()["check3"].GetAllowed())
		assert.True(t, res.GetResults()["check4"].GetAllowed())
		assert.True(t, res.GetResults()["check5"].GetAllowed())
		assert.True(t, res.GetResults()["check6"].GetAllowed())
	})

	t.Run("user:18 should be able to create in root folder", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbCreate, folderGroup, folderResource, "", "", ""),
			newItem("check2", utils.VerbCreate, dashboardGroup, dashboardResource, "", "", ""),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:18", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
	})

	t.Run("different verbs in same batch", func(t *testing.T) {
		items := []*authzv1.BatchCheckItem{
			newItem("check1", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			newItem("check2", utils.VerbUpdate, dashboardGroup, dashboardResource, "", "1", "1"),
		}
		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:1", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 2)
		// user:1 has both get and update access to dashboard 1
		assert.True(t, res.GetResults()["check1"].GetAllowed())
		assert.True(t, res.GetResults()["check2"].GetAllowed())
	})
}

func TestIntegrationServerBatchCheck_SubBatching(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)

	// Set a low limit to force sub-batching within the test
	server.cfg.OpenFgaServerSettings = setting.OpenFgaServerSettings{
		MaxChecksPerBatchCheck: 3,
	}

	newBatchReq := func(subject string, items []*authzv1.BatchCheckItem) *authzv1.BatchCheckRequest {
		return &authzv1.BatchCheckRequest{
			Namespace: namespace,
			Subject:   subject,
			Checks:    items,
		}
	}

	newItem := func(correlationID, verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
		return &authzv1.BatchCheckItem{
			CorrelationId: correlationID,
			Verb:          verb,
			Group:         group,
			Resource:      resource,
			Subresource:   subresource,
			Name:          name,
			Folder:        folder,
		}
	}

	t.Run("batch exceeding limit returns correct results for all items", func(t *testing.T) {
		// user:2 has group_resource access to all dashboards, so all should be allowed.
		// 7 items with MaxChecksPerBatchCheck=3 forces splitting into multiple sub-batches.
		items := make([]*authzv1.BatchCheckItem, 7)
		for i := range items {
			items[i] = newItem(
				fmt.Sprintf("check-%d", i),
				utils.VerbGet, dashboardGroup, dashboardResource, "", "1", fmt.Sprintf("%d", i+1),
			)
		}

		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:2", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 7)
		for i := range items {
			assert.True(t, res.GetResults()[fmt.Sprintf("check-%d", i)].GetAllowed(),
				"check-%d should be allowed via group_resource access", i)
		}
	})

	t.Run("batch exceeding limit preserves mixed allowed and denied results", func(t *testing.T) {
		// user:4 has folder-based access to folders 1 and 3 but not folder 2.
		// Generate items across folders to get a mix of allowed/denied across sub-batches.
		items := []*authzv1.BatchCheckItem{
			newItem("f1-a", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "100"), // allowed
			newItem("f1-b", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "101"), // allowed
			newItem("f2-a", utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "200"), // denied
			newItem("f3-a", utils.VerbGet, dashboardGroup, dashboardResource, "", "3", "300"), // allowed
			newItem("f2-b", utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "201"), // denied
			newItem("f1-c", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "102"), // allowed
			newItem("f3-b", utils.VerbGet, dashboardGroup, dashboardResource, "", "3", "301"), // allowed
		}

		res, err := server.BatchCheck(newContextWithNamespace(), newBatchReq("user:4", items))
		require.NoError(t, err)
		require.Len(t, res.GetResults(), 7)

		assert.True(t, res.GetResults()["f1-a"].GetAllowed())
		assert.True(t, res.GetResults()["f1-b"].GetAllowed())
		assert.False(t, res.GetResults()["f2-a"].GetAllowed())
		assert.True(t, res.GetResults()["f3-a"].GetAllowed())
		assert.False(t, res.GetResults()["f2-b"].GetAllowed())
		assert.True(t, res.GetResults()["f1-c"].GetAllowed())
		assert.True(t, res.GetResults()["f3-b"].GetAllowed())
	})
}
