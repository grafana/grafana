package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/fileblob"
	"gocloud.dev/blob/memblob"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestSimpleServer(t *testing.T) {
	testUserA := &identity.StaticRequester{
		Type:           claims.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}
	ctx := claims.WithAuthInfo(context.Background(), testUserA)

	bucket := memblob.OpenBucket(nil)
	if false {
		tmp, err := os.MkdirTemp("", "xxx-*")
		require.NoError(t, err)

		bucket, err = fileblob.OpenBucket(tmp, &fileblob.Options{
			CreateDir: true,
			Metadata:  fileblob.MetadataDontWrite, // skip
		})
		require.NoError(t, err)
		fmt.Printf("ROOT: %s\n\n", tmp)
	}
	store, err := NewCDKBackend(ctx, CDKBackendOptions{
		Bucket: bucket,
	})
	require.NoError(t, err)

	server, err := NewResourceServer(ResourceServerOptions{
		Backend: store,
	})
	require.NoError(t, err)

	t.Run("playlist happy CRUD paths", func(t *testing.T) {
		raw := []byte(`{
    		"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"uid": "xyz",
				"namespace": "default",
				"annotations": {
					"grafana.app/repoName": "elsewhere",
					"grafana.app/repoPath": "path/to/item",
					"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
				}
			},
			"spec": {
				"title": "hello",
				"interval": "5m",
				"items": [
					{
						"type": "dashboard_by_uid",
						"value": "vmie2cmWz"
					}
				]
			}
		}`)

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		// Should be empty when we start
		all, err := server.List(ctx, &ListRequest{Options: &ListOptions{
			Key: &ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0)

		// should return 404 if not found
		found, err := server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, found.Error)
		require.Equal(t, int32(http.StatusNotFound), found.Error.Code)

		created, err := server.Create(ctx, &CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)
		require.Nil(t, created.Error)
		require.True(t, created.ResourceVersion > 0)

		// The key does not include resource version
		found, err = server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		require.Equal(t, created.ResourceVersion, found.ResourceVersion)

		// Now update the value
		tmp := &unstructured.Unstructured{}
		err = json.Unmarshal(found.Value, tmp)
		require.NoError(t, err)

		now := time.Now().UnixMilli()
		obj, err := utils.MetaAccessor(tmp)
		require.NoError(t, err)
		obj.SetAnnotation("test", "hello")
		obj.SetUpdatedTimestampMillis(now)
		obj.SetUpdatedBy(testUserA.GetUID())
		obj.SetLabels(map[string]string{
			utils.LabelKeyGetTrash: "", // should not be allowed to save this!
		})
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)
		updated, err := server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Equal(t, int32(400), updated.Error.Code) // bad request

		// remove the invalid labels
		obj.SetLabels(nil)
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)
		updated, err = server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)
		require.Nil(t, updated.Error)
		require.True(t, updated.ResourceVersion > created.ResourceVersion)

		// We should still get the latest
		found, err = server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Nil(t, found.Error)
		require.Equal(t, updated.ResourceVersion, found.ResourceVersion)

		all, err = server.List(ctx, &ListRequest{Options: &ListOptions{
			Key: &ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 1)
		require.Equal(t, updated.ResourceVersion, all.Items[0].ResourceVersion)

		deleted, err := server.Delete(ctx, &DeleteRequest{Key: key, ResourceVersion: updated.ResourceVersion})
		require.NoError(t, err)
		require.True(t, deleted.ResourceVersion > updated.ResourceVersion)

		// We should get not found status when trying to read the latest value
		found, err = server.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.NotNil(t, found.Error)
		require.Equal(t, int32(404), found.Error.Code)

		// And the deleted value should not be in the results
		all, err = server.List(ctx, &ListRequest{Options: &ListOptions{
			Key: &ResourceKey{
				Group:    key.Group,
				Resource: key.Resource,
			},
		}})
		require.NoError(t, err)
		require.Len(t, all.Items, 0) // empty
	})

	t.Run("playlist update optimistic concurrency check", func(t *testing.T) {
		raw := []byte(`{
    	"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind": "Playlist",
			"metadata": {
				"name": "fdgsv37qslr0ga",
				"namespace": "default",
				"uid": "xyz",
				"annotations": {
					"grafana.app/repoName": "elsewhere",
					"grafana.app/repoPath": "path/to/item",
					"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
				}
			},
			"spec": {
				"title": "hello",
				"interval": "5m",
				"items": [
					{
						"type": "dashboard_by_uid",
						"value": "vmie2cmWz"
					}
				]
			}
		}`)

		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}

		created, err := server.Create(ctx, &CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)

		// Update should return an ErrOptimisticLockingFailed the second time

		_, err = server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.NoError(t, err)

		_, err = server.Update(ctx, &UpdateRequest{
			Key:             key,
			Value:           raw,
			ResourceVersion: created.ResourceVersion})
		require.ErrorIs(t, err, ErrOptimisticLockingFailed)
	})
}

func TestResourcePermissionScenarios(t *testing.T) {
	// Test user
	testUser := &identity.StaticRequester{
		Type:           claims.TypeUser,
		Login:          "testuser",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	}

	testCases := []struct {
		name           string
		initialFolder  string
		targetFolder   string
		permissionMap  map[string]bool
		expectSuccess  bool
		expectedChecks int
		expectedError  int32 // HTTP status code for error, 0 if no error expected
	}{
		{
			name:           "Create resource in folder",
			initialFolder:  "folder1",
			targetFolder:   "", // No move, just create
			permissionMap:  map[string]bool{"folder1:create": true},
			expectSuccess:  true,
			expectedChecks: 1,
			expectedError:  0,
		},
		{
			name:           "Create resource denied",
			initialFolder:  "folder1",
			targetFolder:   "", // No move, just create
			permissionMap:  map[string]bool{"folder1:create": false},
			expectSuccess:  false,
			expectedChecks: 1,
			expectedError:  http.StatusForbidden,
		},
		{
			name:           "Update resource in same folder",
			initialFolder:  "folder1",
			targetFolder:   "folder1", // Same folder, just update
			permissionMap:  map[string]bool{"folder1:update": true},
			expectSuccess:  true,
			expectedChecks: 1,
			expectedError:  0,
		},
		{
			name:           "Update resource denied",
			initialFolder:  "folder1",
			targetFolder:   "folder1", // Same folder
			permissionMap:  map[string]bool{"folder1:update": false},
			expectSuccess:  false,
			expectedChecks: 1,
			expectedError:  http.StatusForbidden,
		},
		{
			name:           "Move resource to another folder - allowed",
			initialFolder:  "folder1",
			targetFolder:   "folder2", // Moving to a different folder
			permissionMap:  map[string]bool{"folder1:update": true, "folder2:create": true},
			expectSuccess:  true,
			expectedChecks: 2, // Should check both folders
			expectedError:  0,
		},
		{
			name:           "Move resource - source folder access denied",
			initialFolder:  "folder1",
			targetFolder:   "folder2",
			permissionMap:  map[string]bool{"folder1:update": false, "folder2:create": true},
			expectSuccess:  false,
			expectedChecks: 1, // Should stop at first check
			expectedError:  http.StatusForbidden,
		},
		{
			name:           "Move resource - destination folder access denied",
			initialFolder:  "folder1",
			targetFolder:   "folder2",
			permissionMap:  map[string]bool{"folder1:update": true, "folder2:create": false},
			expectSuccess:  false,
			expectedChecks: 2, // Should do both checks but fail on second
			expectedError:  http.StatusForbidden,
		},
		{
			name:           "Move resource - from empty folder to named folder",
			initialFolder:  "",
			targetFolder:   "folder1",
			permissionMap:  map[string]bool{":update": true, "folder1:create": true},
			expectSuccess:  true,
			expectedChecks: 2,
			expectedError:  0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Reset the backend for each test
			store, err := NewCDKBackend(context.Background(), CDKBackendOptions{
				Bucket: memblob.OpenBucket(nil),
			})
			require.NoError(t, err)

			// Create a mock access client with the test case's permission map
			checksPerformed := []claims.CheckRequest{}
			mockAccess := &mockAccessClient{
				allowed:    false, // Default to false
				allowedMap: tc.permissionMap,
				checkFn: func(req claims.CheckRequest) {
					checksPerformed = append(checksPerformed, req)
				},
			}

			server, err := NewResourceServer(ResourceServerOptions{
				Backend:      store,
				AccessClient: mockAccess,
			})
			require.NoError(t, err)

			ctx := claims.WithAuthInfo(context.Background(), testUser)

			// The resource key is the same for all tests
			key := &ResourceKey{
				Group:     "test.grafana.app",
				Resource:  "testresources",
				Namespace: "default",
				Name:      "test-resource",
			}

			// If this is a create-only test
			if tc.targetFolder == "" {
				// Create resource
				resourceJSON := fmt.Sprintf(`{
					"apiVersion": "test.grafana.app/v1",
					"kind": "TestResource",
					"metadata": {
						"name": "test-resource",
						"uid": "test123",
						"namespace": "default",
						"annotations": {
							"grafana.app/folder": "%s"
						}
					},
					"spec": {
						"title": "Test Resource"
					}
				}`, tc.initialFolder)

				checksPerformed = []claims.CheckRequest{}
				created, err := server.Create(ctx, &CreateRequest{
					Value: []byte(resourceJSON),
					Key:   key,
				})
				require.NoError(t, err)

				if tc.expectSuccess {
					require.Nil(t, created.Error)
					require.True(t, created.ResourceVersion > 0)
				} else {
					require.NotNil(t, created.Error)
					require.Equal(t, tc.expectedError, created.Error.Code)
				}

				require.Len(t, checksPerformed, tc.expectedChecks)
				if len(checksPerformed) > 0 {
					require.Equal(t, utils.VerbCreate, checksPerformed[0].Verb)
					require.Equal(t, tc.initialFolder, checksPerformed[0].Folder)
				}
			} else {
				// Create a resource first, then update/move it
				initialResourceJSON := fmt.Sprintf(`{
					"apiVersion": "test.grafana.app/v1",
					"kind": "TestResource",
					"metadata": {
						"name": "test-resource",
						"uid": "test123",
						"namespace": "default",
						"annotations": {
							"grafana.app/folder": "%s"
						}
					},
					"spec": {
						"title": "Test Resource"
					}
				}`, tc.initialFolder)

				// Override permissions for initial creation to always succeed
				mockAccess.allowed = true
				created, err := server.Create(ctx, &CreateRequest{
					Value: []byte(initialResourceJSON),
					Key:   key,
				})
				require.NoError(t, err)
				require.Nil(t, created.Error)

				// Now try the update/move with the configured permissions
				targetResourceJSON := fmt.Sprintf(`{
					"apiVersion": "test.grafana.app/v1",
					"kind": "TestResource",
					"metadata": {
						"name": "test-resource",
						"uid": "test123",
						"namespace": "default",
						"annotations": {
							"grafana.app/folder": "%s"
						}
					},
					"spec": {
						"title": "Test Resource Updated"
					}
				}`, tc.targetFolder)

				mockAccess.allowed = false // Reset to use the map
				checksPerformed = []claims.CheckRequest{}

				updated, err := server.Update(ctx, &UpdateRequest{
					Key:             key,
					Value:           []byte(targetResourceJSON),
					ResourceVersion: created.ResourceVersion,
				})
				require.NoError(t, err)

				if tc.expectSuccess {
					require.Nil(t, updated.Error)
					require.True(t, updated.ResourceVersion > created.ResourceVersion)
				} else {
					require.NotNil(t, updated.Error)
					require.Equal(t, tc.expectedError, updated.Error.Code)
				}

				require.Len(t, checksPerformed, tc.expectedChecks)

				// Verify the correct permission checks were made
				if tc.initialFolder != tc.targetFolder && len(checksPerformed) >= 2 {
					// This is a folder move operation
					require.Equal(t, utils.VerbUpdate, checksPerformed[0].Verb)
					require.Equal(t, tc.initialFolder, checksPerformed[0].Folder)

					require.Equal(t, utils.VerbCreate, checksPerformed[1].Verb)
					require.Equal(t, tc.targetFolder, checksPerformed[1].Folder)
				} else if len(checksPerformed) > 0 {
					// Regular update, no folder change
					require.Equal(t, utils.VerbUpdate, checksPerformed[0].Verb)
					require.Equal(t, tc.initialFolder, checksPerformed[0].Folder)
				}
			}
		})
	}
}

// Mock access client for testing
type mockAccessClient struct {
	allowed    bool
	allowedMap map[string]bool
	checkFn    func(claims.CheckRequest)
}

func (m *mockAccessClient) Check(ctx context.Context, user claims.AuthInfo, req claims.CheckRequest) (claims.CheckResponse, error) {
	if m.checkFn != nil {
		m.checkFn(req)
	}

	// Check specific folder:verb mappings if provided
	if m.allowedMap != nil {
		key := fmt.Sprintf("%s:%s", req.Folder, req.Verb)
		if allowed, exists := m.allowedMap[key]; exists {
			return claims.CheckResponse{Allowed: allowed}, nil
		}
	}

	return claims.CheckResponse{Allowed: m.allowed}, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, user claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, error) {
	return func(name, folder string) bool {
		key := fmt.Sprintf("%s:%s", folder, req.Verb)
		if allowed, exists := m.allowedMap[key]; exists {
			return allowed
		}
		return m.allowed
	}, nil
}
