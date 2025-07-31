package test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"

	"github.com/stretchr/testify/require"
)

// RunStorageServerTest runs the storage server test suite
func RunStorageServerTest(t *testing.T, newBackend NewBackendFunc) {
	runTestResourcePermissionScenarios(t, newBackend(context.Background()), GenerateRandomNSPrefix())
	runTestListTrashAccessControl(t, newBackend(context.Background()), GenerateRandomNSPrefix())
}

// func runTestIntegrationBackendHappyPath(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
func runTestResourcePermissionScenarios(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	// Test user
	testUser := &identity.StaticRequester{
		Type:           types.TypeUser,
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

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a unique resource name for each test
			resourceName := fmt.Sprintf("test-resource-%d", i)
			resourceUID := fmt.Sprintf("test123-%d", i)

			// Create a mock access client with the test case's permission map
			checksPerformed := []types.CheckRequest{}
			mockAccess := &mockAccessClient{
				allowed:    false, // Default to false
				allowedMap: tc.permissionMap,
				checkFn: func(req types.CheckRequest) {
					checksPerformed = append(checksPerformed, req)
				},
			}

			server, err := resource.NewResourceServer(resource.ResourceServerOptions{
				Backend:      backend,
				AccessClient: mockAccess,
			})
			require.NoError(t, err)

			ctx := types.WithAuthInfo(context.Background(), testUser)

			key := &resourcepb.ResourceKey{
				Group:     "test.grafana.app",
				Resource:  "testresources",
				Namespace: nsPrefix + "-ns1",
				Name:      resourceName,
			}

			if tc.targetFolder == "" {
				// Create resource with unique name
				resourceJSON := fmt.Sprintf(`{
					"apiVersion": "test.grafana.app/v1",
					"kind": "TestResource",
					"metadata": {
						"name": "%s",
						"uid": "%s",
						"namespace": "%s",
						"annotations": {
							"grafana.app/folder": "%s"
						}
					},
					"spec": {
						"title": "Test Resource %d"
					}
				}`, resourceName, resourceUID, nsPrefix+"-ns1", tc.initialFolder, i)

				checksPerformed = []types.CheckRequest{}
				created, err := server.Create(ctx, &resourcepb.CreateRequest{
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
						"name": "%s",
						"uid": "%s",
						"namespace": "%s",
						"annotations": {
							"grafana.app/folder": "%s"
						}
					},
					"spec": {
						"title": "Test Resource %d"
					}
				}`, resourceName, resourceUID, nsPrefix+"-ns1", tc.initialFolder, i)

				// Override permissions for initial creation to always succeed
				mockAccess.allowed = true
				created, err := server.Create(ctx, &resourcepb.CreateRequest{
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
						"name": "%s",
						"uid": "%s",
						"namespace": "%s",
						"annotations": {
							"grafana.app/folder": "%s"
						}
					},
					"spec": {
						"title": "Test Resource %d Updated"
					}
				}`, resourceName, resourceUID, nsPrefix+"-ns1", tc.targetFolder, i)

				mockAccess.allowed = false // Reset to use the map
				checksPerformed = []types.CheckRequest{}

				updated, err := server.Update(ctx, &resourcepb.UpdateRequest{
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

// runTestListTrashAccessControl tests the access control logic for ListTrash
func runTestListTrashAccessControl(t *testing.T, backend resource.StorageBackend, nsPrefix string) {
	// Create two different users
	testUserA := &identity.StaticRequester{
		Type:           types.TypeUser,
		Login:          "testuserA",
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // admin user
	}

	testUserB := &identity.StaticRequester{
		Type:           types.TypeUser,
		Login:          "testuserB",
		UserID:         456,
		UserUID:        "u456",
		OrgRole:        identity.RoleEditor,
		IsGrafanaAdmin: false, // non-admin user
	}

	mockAccess := &mockAccessClient{
		allowed: true, // Allow regular access
		compileFn: func(user types.AuthInfo, req types.ListRequest) types.ItemChecker {
			return func(name, folder string) bool {
				if req.Verb == utils.VerbSetPermissions {
					if requester, ok := user.(identity.Requester); ok && requester.GetIsGrafanaAdmin() {
						return true // Admin users can access trash
					}
					return false // Non-admin users cannot access trash
				}
				return false
			}
		},
	}

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: mockAccess,
	})
	require.NoError(t, err)

	// Create a resource and delete it with user A
	ctxA := types.WithAuthInfo(context.Background(), testUserA)

	raw := []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "trash-test-playlist",
			"uid": "trash-xyz",
			"namespace": "` + nsPrefix + `-trash-test",
			"annotations": {
				"grafana.app/repoName": "elsewhere",
				"grafana.app/repoPath": "path/to/item",
				"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
			}
		},
		"spec": {
			"title": "trash test",
			"interval": "5m",
			"items": [
				{
					"type": "dashboard_by_uid",
					"value": "vmie2cmWz"
				}
			]
		}
	}`)

	key := &resourcepb.ResourceKey{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: nsPrefix + "-trash-test",
		Name:      "trash-test-playlist",
	}

	// Create the resource with user A
	created, err := server.Create(ctxA, &resourcepb.CreateRequest{
		Value: raw,
		Key:   key,
	})
	require.NoError(t, err)
	require.Nil(t, created.Error)

	// Delete the resource with user A
	deleted, err := server.Delete(ctxA, &resourcepb.DeleteRequest{
		Key:             key,
		ResourceVersion: created.ResourceVersion,
	})
	require.NoError(t, err)
	require.True(t, deleted.ResourceVersion > created.ResourceVersion)

	// Test 1: Admin user (user A) should be able to list trash and see their own deleted resource
	trashList, err := server.List(ctxA, &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_TRASH,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     key.Group,
				Resource:  key.Resource,
				Namespace: key.Namespace,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, trashList.Error)
	require.Len(t, trashList.Items, 1, "Admin user should see the deleted resource in trash")

	// Test 2: Non-admin user (user B) who didn't delete the resource should NOT see it in trash
	ctxB := types.WithAuthInfo(context.Background(), testUserB)
	trashListB, err := server.List(ctxB, &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_TRASH,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     key.Group,
				Resource:  key.Resource,
				Namespace: key.Namespace,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, trashListB.Error)
	require.Len(t, trashListB.Items, 0, "Non-admin user who didn't delete the resource should not see it in trash")

	// Test 3: Create and delete another resource with user B
	keyB := &resourcepb.ResourceKey{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: nsPrefix + "-trash-test",
		Name:      "trash-test-playlist-b",
	}

	rawB := []byte(`{
		"apiVersion": "playlist.grafana.app/v0alpha1",
		"kind": "Playlist",
		"metadata": {
			"name": "trash-test-playlist-b",
			"uid": "trash-xyz-b",
			"namespace": "` + nsPrefix + `-trash-test",
			"annotations": {
				"grafana.app/repoName": "elsewhere",
				"grafana.app/repoPath": "path/to/item",
				"grafana.app/repoTimestamp": "2024-02-02T00:00:00Z"
			}
		},
		"spec": {
			"title": "trash test b",
			"interval": "5m",
			"items": [
				{
					"type": "dashboard_by_uid",
					"value": "vmie2cmWz"
				}
			]
		}
	}`)

	// Create the resource with user B
	createdB, err := server.Create(ctxB, &resourcepb.CreateRequest{
		Value: rawB,
		Key:   keyB,
	})
	require.NoError(t, err)
	require.Nil(t, createdB.Error)

	// Delete the resource with user B
	deletedB, err := server.Delete(ctxB, &resourcepb.DeleteRequest{
		Key:             keyB,
		ResourceVersion: createdB.ResourceVersion,
	})
	require.NoError(t, err)
	require.True(t, deletedB.ResourceVersion > createdB.ResourceVersion)

	// Test 4: User B should see their own deleted resource in trash
	trashListB2, err := server.List(ctxB, &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_TRASH,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     keyB.Group,
				Resource:  keyB.Resource,
				Namespace: keyB.Namespace,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, trashListB2.Error)
	require.Len(t, trashListB2.Items, 1, "User should see their own deleted resource in trash")

	// Test 5: Admin user should see both deleted resources
	trashListA2, err := server.List(ctxA, &resourcepb.ListRequest{
		Source: resourcepb.ListRequest_TRASH,
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     key.Group,
				Resource:  key.Resource,
				Namespace: key.Namespace,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, trashListA2.Error)
	require.Len(t, trashListA2.Items, 2, "Admin user should see all deleted resources in trash")

	// Test 6: Verify the trash items have the correct metadata
	for _, item := range trashListA2.Items {
		var obj map[string]interface{}
		err := json.Unmarshal(item.Value, &obj)
		require.NoError(t, err)

		// Check that the item has deletion timestamp
		metadata, ok := obj["metadata"].(map[string]interface{})
		require.True(t, ok, "Resource should have metadata")
		require.NotNil(t, metadata["deletionTimestamp"], "Trash item should have deletion timestamp")

		// Check that the item has the correct updatedBy field
		annotations, ok := metadata["annotations"].(map[string]interface{})
		require.True(t, ok, "Resource should have annotations")
		require.Contains(t, annotations, "grafana.app/updatedBy", "Trash item should have updatedBy annotation")
	}
}

// Mock access client for testing
type mockAccessClient struct {
	allowed    bool
	allowedMap map[string]bool
	checkFn    func(types.CheckRequest)
	compileFn  func(user types.AuthInfo, req types.ListRequest) types.ItemChecker
}

func (m *mockAccessClient) Check(ctx context.Context, user types.AuthInfo, req types.CheckRequest) (types.CheckResponse, error) {
	if m.checkFn != nil {
		m.checkFn(req)
	}

	// Check specific folder:verb mappings if provided
	if m.allowedMap != nil {
		key := fmt.Sprintf("%s:%s", req.Folder, req.Verb)
		if allowed, exists := m.allowedMap[key]; exists {
			return types.CheckResponse{Allowed: allowed}, nil
		}
	}

	return types.CheckResponse{Allowed: m.allowed}, nil
}

func (m *mockAccessClient) Compile(ctx context.Context, user types.AuthInfo, req types.ListRequest) (types.ItemChecker, error) {
	if m.compileFn != nil {
		return m.compileFn(user, req), nil
	}
	return func(name, folder string) bool {
		key := fmt.Sprintf("%s:%s", folder, req.Verb)
		if allowed, exists := m.allowedMap[key]; exists {
			return allowed
		}
		return m.allowed
	}, nil
}
