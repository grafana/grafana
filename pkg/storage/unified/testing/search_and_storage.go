package test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func RunTestSearchAndStorage(t *testing.T, ctx context.Context, backend resource.StorageBackend, searchBackend resource.SearchBackend) {
	// Create a test user with admin permissions
	testUser := &identity.StaticRequester{
		Type:           claims.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}
	ctx = claims.WithAuthInfo(ctx, testUser)

	nsPrefix := "test-ns"

	var server resource.ResourceServer

	t.Run("Create initial resources in storage", func(t *testing.T) {
		initialResources := []struct {
			name  string
			title string
			tags  []string
		}{
			{
				name:  "initial1",
				title: "First Initial Document",
				tags:  []string{"tag0", "initial"},
			},
			{
				name:  "initial2",
				title: "Second Initial Document",
				tags:  []string{"tag0", "initial"},
			},
		}

		for _, doc := range initialResources {
			key := &resourcepb.ResourceKey{
				Group:     "test.grafana.app",
				Resource:  "testresources",
				Namespace: nsPrefix,
				Name:      doc.name,
			}

			// Create document using unstructured
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "test.grafana.app/v1",
					"kind":       "testresources",
					"metadata": map[string]interface{}{
						"name":      doc.name,
						"namespace": nsPrefix,
					},
					"spec": map[string]interface{}{
						"title": doc.title,
						"tags":  doc.tags,
					},
				},
			}

			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)

			// Convert unstructured to bytes
			value, err := obj.MarshalJSON()
			require.NoError(t, err)

			// Create document
			rv, err := backend.WriteEvent(ctx, resource.WriteEvent{
				Type:   resourcepb.WatchEvent_ADDED,
				Key:    key,
				Value:  value,
				Object: meta,
				GUID:   uuid.New().String(),
			})
			require.NoError(t, err)
			require.Greater(t, rv, int64(0))
		}
	})

	t.Run("Create a resource server with both backends", func(t *testing.T) {
		// Create a resource server with both backends
		var err error
		server, err = resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: backend,
			Search: resource.SearchOptions{
				Backend: searchBackend,
				Resources: &resource.TestDocumentBuilderSupplier{
					GroupsResources: map[string]string{
						"test.grafana.app": "testresources",
					},
				},
			},
		})
		require.NoError(t, err)
	})

	t.Run("Search for initial resources", func(t *testing.T) {
		// Test 1: Search for initial resources
		searchResp, err := server.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     "test.grafana.app",
					Resource:  "testresources",
					Namespace: nsPrefix,
				},
			},
			Query: "initial",
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, searchResp)
		require.Nil(t, searchResp.Error)
		require.Equal(t, int64(2), searchResp.TotalHits)
	})

	t.Run("Add search documents", func(t *testing.T) {
		testDocs := []struct {
			name  string
			title string
			tags  []string
		}{
			{
				name:  "doc1",
				title: "First Test Document",
				tags:  []string{"hello", "tag1"},
			},
			{
				name:  "doc2",
				title: "Second Test Document",
				tags:  []string{"hello", "tag2"},
			},
			{
				name:  "doc3",
				title: "Third Test Document",
				tags:  []string{"hello", "tag3"},
			},
		}

		for _, doc := range testDocs {
			key := &resourcepb.ResourceKey{
				Group:     "test.grafana.app",
				Resource:  "testresources",
				Namespace: nsPrefix,
				Name:      doc.name,
			}

			// Create document using unstructured
			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "test.grafana.app/v1",
					"kind":       "testresources",
					"metadata": map[string]interface{}{
						"name":      doc.name,
						"namespace": nsPrefix,
					},
					"spec": map[string]interface{}{
						"title": doc.title,
						"tags":  doc.tags,
					},
				},
			}

			// Convert unstructured to bytes
			value, err := obj.MarshalJSON()
			require.NoError(t, err)

			// Create document
			createResp, err := server.Create(ctx, &resourcepb.CreateRequest{
				Key:   key,
				Value: value,
			})
			require.NoError(t, err)
			require.NotNil(t, createResp)
			require.Nil(t, createResp.Error)
		}
	})

	t.Run("Search for documents", func(t *testing.T) {
		searchResp, err := server.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     "test.grafana.app",
					Resource:  "testresources",
					Namespace: nsPrefix,
				},
			},
			Query: "Document",
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, searchResp)
		require.Nil(t, searchResp.Error)
		require.Equal(t, int64(5), searchResp.TotalHits)
	})

	t.Run("Search with tags", func(t *testing.T) {
		searchResp, err := server.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     "test.grafana.app",
					Resource:  "testresources",
					Namespace: nsPrefix,
				},
			},
			Query: "hello",
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, searchResp)
		require.Nil(t, searchResp.Error)
		require.Equal(t, int64(3), searchResp.TotalHits)
	})

	t.Run("Search with specific tag", func(t *testing.T) {
		searchResp, err := server.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     "test.grafana.app",
					Resource:  "testresources",
					Namespace: nsPrefix,
				},
			},
			Query: "tag1",
			Limit: 10,
		})
		require.NoError(t, err)
		require.NotNil(t, searchResp)
		require.Nil(t, searchResp.Error)
		require.Equal(t, int64(1), searchResp.TotalHits)
	})
}
