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
			Subject: subject,
			Checks:  items,
		}
	}

	// Helper to create a batch check item with correlation ID (uses default namespace)
	newItem := func(verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
		correlationID := fmt.Sprintf("%s-%s-%s-%s", group, resource, folder, name)
		return &authzv1.BatchCheckItem{
			Namespace:     namespace,
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

	// Cross-namespace tests
	t.Run("cross-namespace: items with explicit namespace should be authorized against their own namespace", func(t *testing.T) {
		// Helper to create item with explicit namespace
		newItemWithNamespace := func(ns, verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
			correlationID := fmt.Sprintf("%s-%s-%s-%s-%s", ns, group, resource, folder, name)
			return &authzv1.BatchCheckItem{
				Namespace:     ns,
				Verb:          verb,
				Group:         group,
				Resource:      resource,
				Subresource:   subresource,
				Name:          name,
				Folder:        folder,
				CorrelationId: correlationID,
			}
		}

		// user:1 has access to dashboard 1 in folder 1 in "default" namespace
		// Both items use explicit namespace
		res, err := server.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
			Subject: "user:1",
			Checks: []*authzv1.BatchCheckItem{
				// Item in default namespace (should be allowed - user:1 has access)
				newItemWithNamespace(namespace, utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
				// Another item in default namespace with different correlation ID
				newItem(utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Results, 2)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", namespace, dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s", dashboardGroup, dashboardResource, "1", "1")].Allowed)
	})

	t.Run("cross-namespace: items from different namespaces in same batch", func(t *testing.T) {
		newItemWithNamespace := func(ns, verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
			correlationID := fmt.Sprintf("%s-%s-%s-%s-%s", ns, group, resource, folder, name)
			return &authzv1.BatchCheckItem{
				Namespace:     ns,
				Verb:          verb,
				Group:         group,
				Resource:      resource,
				Subresource:   subresource,
				Name:          name,
				Folder:        folder,
				CorrelationId: correlationID,
			}
		}

		// user:2 has group_resource access in "default" namespace
		// They should have access in default but not in other-namespace (no tuples there)
		res, err := server.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
			Subject: "user:2",
			Checks: []*authzv1.BatchCheckItem{
				// Items in default namespace (should be allowed - user:2 has group_resource access)
				newItemWithNamespace(namespace, utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
				newItemWithNamespace(namespace, utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
				// Items in other-namespace (should be denied - no tuples in other-namespace)
				newItemWithNamespace("other-namespace", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
				newItemWithNamespace("other-namespace", utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Results, 4)

		// Default namespace items should be allowed
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", namespace, dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", namespace, dashboardGroup, dashboardResource, "2", "2")].Allowed)
		// Other namespace items should be denied (no permissions in that namespace)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", "other-namespace", dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", "other-namespace", dashboardGroup, dashboardResource, "2", "2")].Allowed)
	})

	t.Run("cross-namespace: mixed results across multiple namespaces", func(t *testing.T) {
		newItemWithNamespace := func(ns, verb, group, resource, subresource, folder, name string) *authzv1.BatchCheckItem {
			correlationID := fmt.Sprintf("%s-%s-%s-%s-%s", ns, group, resource, folder, name)
			return &authzv1.BatchCheckItem{
				Namespace:     ns,
				Verb:          verb,
				Group:         group,
				Resource:      resource,
				Subresource:   subresource,
				Name:          name,
				Folder:        folder,
				CorrelationId: correlationID,
			}
		}

		// user:1 has specific access to dashboard 1 in folder 1
		// user:2 would have broader access, but we're testing user:1
		res, err := server.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
			Subject: "user:1",
			Checks: []*authzv1.BatchCheckItem{
				// Allowed in default namespace
				newItemWithNamespace(namespace, utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
				// Denied in default namespace (user:1 doesn't have access to dashboard 2)
				newItemWithNamespace(namespace, utils.VerbGet, dashboardGroup, dashboardResource, "", "2", "2"),
				// Denied in other-namespace (no tuples)
				newItemWithNamespace("other-namespace", utils.VerbGet, dashboardGroup, dashboardResource, "", "1", "1"),
			},
		})
		require.NoError(t, err)
		require.Len(t, res.Results, 3)

		assert.True(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", namespace, dashboardGroup, dashboardResource, "1", "1")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", namespace, dashboardGroup, dashboardResource, "2", "2")].Allowed)
		assert.False(t, res.Results[fmt.Sprintf("%s-%s-%s-%s-%s", "other-namespace", dashboardGroup, dashboardResource, "1", "1")].Allowed)
	})
}
