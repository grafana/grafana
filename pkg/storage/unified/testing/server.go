package test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/stretchr/testify/require"
)

// RunStorageServerTest runs the storage server test suite
func RunStorageServerTest(t *testing.T, newBackend NewBackendFunc) {
	runTestResourcePermissionScenarios(t, newBackend(context.Background()), GenerateRandomNSPrefix())
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

			key := &resource.ResourceKey{
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
				created, err := server.Create(ctx, &resource.CreateRequest{
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
				created, err := server.Create(ctx, &resource.CreateRequest{
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

				updated, err := server.Update(ctx, &resource.UpdateRequest{
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
	checkFn    func(types.CheckRequest)
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
	return func(name, folder string) bool {
		key := fmt.Sprintf("%s:%s", folder, req.Verb)
		if allowed, exists := m.allowedMap[key]; exists {
			return allowed
		}
		return m.allowed
	}, nil
}
