package auth

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// TestAuthorizeResource_SecurityFix tests the critical security fix where authorization
// checks the actual resource's folder, not the folder claimed in the file.
func TestAuthorizeResource_SecurityFix(t *testing.T) {
	tests := []struct {
		name           string
		fileFolderID   string
		existingFolder string
		hasExisting    bool
		verb           string
		expectedFolder string
		description    string
	}{
		{
			name:           "new resource - uses folder from file metadata",
			fileFolderID:   "file-claimed-folder",
			hasExisting:    false,
			verb:           utils.VerbCreate,
			expectedFolder: "file-claimed-folder",
			description:    "For new resources, should use folder from file metadata",
		},
		{
			name:           "existing resource - SECURITY FIX: uses folder from actual resource, not file",
			fileFolderID:   "malicious-claimed-folder", // Attacker claims different folder
			existingFolder: "actual-resource-folder",   // Actual folder
			hasExisting:    true,
			verb:           utils.VerbUpdate,
			expectedFolder: "actual-resource-folder",
			description:    "SECURITY FIX: For existing resources, should use folder from actual resource to prevent permission bypass",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
			}

			// Create mock metadata for file
			mockMeta := utils.NewMockGrafanaMetaAccessor(t)
			mockMeta.On("GetFolder").Return(tt.fileFolderID)

			// Create parsed resource with file metadata
			parsed := &resources.ParsedResource{
				Obj: &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "test-dashboard",
						},
					},
				},
				Meta: mockMeta,
				GVR: schema.GroupVersionResource{
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
				},
			}

			// Add existing resource if needed with folder annotation
			if tt.hasExisting {
				parsed.Existing = &unstructured.Unstructured{
					Object: map[string]interface{}{
						"metadata": map[string]interface{}{
							"name": "test-dashboard",
							"annotations": map[string]interface{}{
								"grafana.app/folder": tt.existingFolder,
							},
						},
					},
				}
			}

			// Set up expectation for the Check call
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				// Verify the request has correct verb and resource
				return req.Verb == tt.verb &&
					req.Group == parsed.GVR.Group &&
					req.Resource == parsed.GVR.Resource
			}), tt.expectedFolder).Return(nil).Once()

			authorizer := NewAuthorizer(repo, mockAccess)
			err := authorizer.AuthorizeResource(context.Background(), parsed, tt.verb)

			assert.NoError(t, err, tt.description)
			mockAccess.AssertExpectations(t)
			mockMeta.AssertExpectations(t)
		})
	}
}

// TestAuthorizeCreateFolder tests authorization checks for folder creation.
func TestAuthorizeCreateFolder(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		repoName     string
		shouldAllow  bool
		description  string
	}{
		{
			name:        "create folder with permission",
			path:        "team-folder/",
			repoName:    "test-repo",
			shouldAllow: true,
			description: "Should allow folder creation when user has create permission on parent",
		},
		{
			name:        "create folder without permission",
			path:        "restricted-folder/",
			repoName:    "test-repo",
			shouldAllow: false,
			description: "Should deny folder creation when user lacks create permission on parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			if tt.shouldAllow {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbCreate &&
						req.Group == resources.FolderResource.Group &&
						req.Resource == resources.FolderResource.Resource
				}), mock.Anything).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()
			}

			authorizer := NewAuthorizer(repo, mockAccess)
			err := authorizer.AuthorizeCreateFolder(context.Background(), tt.path)

			if tt.shouldAllow {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeDeleteFolder tests authorization checks for folder deletion.
func TestAuthorizeDeleteFolder(t *testing.T) {
	tests := []struct {
		name         string
		path         string
		repoName     string
		shouldAllow  bool
		description  string
	}{
		{
			name:        "delete folder with permission",
			path:        "team-folder/",
			repoName:    "test-repo",
			shouldAllow: true,
			description: "Should allow folder deletion when user has delete permission",
		},
		{
			name:        "delete folder without permission",
			path:        "restricted-folder/",
			repoName:    "test-repo",
			shouldAllow: false,
			description: "Should deny folder deletion when user lacks delete permission",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			expectedFolderID := resources.ParseFolder(tt.path, tt.repoName).ID

			if tt.shouldAllow {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbDelete &&
						req.Group == resources.FolderResource.Group &&
						req.Resource == resources.FolderResource.Resource
				}), expectedFolderID).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.Anything, expectedFolderID).Return(assert.AnError).Once()
			}

			authorizer := NewAuthorizer(repo, mockAccess)
			err := authorizer.AuthorizeDeleteFolder(context.Background(), tt.path)

			if tt.shouldAllow {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeMoveFolder tests authorization checks for folder moves.
func TestAuthorizeMoveFolder(t *testing.T) {
	tests := []struct {
		name              string
		originalPath      string
		targetPath        string
		repoName          string
		allowSourceUpdate bool
		allowTargetCreate bool
		shouldSucceed     bool
		description       string
	}{
		{
			name:              "move folder with full permissions",
			originalPath:      "old-folder/",
			targetPath:        "new-folder/",
			repoName:          "test-repo",
			allowSourceUpdate: true,
			allowTargetCreate: true,
			shouldSucceed:     true,
			description:       "Should allow folder move when user has update on source and create on target parent",
		},
		{
			name:              "move folder without source update permission",
			originalPath:      "restricted-folder/",
			targetPath:        "new-location/",
			repoName:          "test-repo",
			allowSourceUpdate: false,
			allowTargetCreate: true,
			shouldSucceed:     false,
			description:       "Should deny folder move when user lacks update permission on source",
		},
		{
			name:              "move folder without target create permission",
			originalPath:      "allowed-folder/",
			targetPath:        "restricted-target/",
			repoName:          "test-repo",
			allowSourceUpdate: true,
			allowTargetCreate: false,
			shouldSucceed:     false,
			description:       "Should deny folder move when user lacks create permission on target parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			sourceFolderID := resources.ParseFolder(tt.originalPath, tt.repoName).ID

			// Set up expectation for source folder update check
			if tt.allowSourceUpdate {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbUpdate &&
						req.Group == resources.FolderResource.Group &&
						req.Resource == resources.FolderResource.Resource
				}), sourceFolderID).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbUpdate
				}), sourceFolderID).Return(assert.AnError).Once()
			}

			// Only check target if source check passes
			if tt.allowSourceUpdate {
				if tt.allowTargetCreate {
					mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
						return req.Verb == utils.VerbCreate &&
							req.Group == resources.FolderResource.Group &&
							req.Resource == resources.FolderResource.Resource
					}), mock.Anything).Return(nil).Once()
				} else {
					mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
						return req.Verb == utils.VerbCreate
					}), mock.Anything).Return(assert.AnError).Once()
				}
			}

			authorizer := NewAuthorizer(repo, mockAccess)
			err := authorizer.AuthorizeMoveFolder(context.Background(), tt.originalPath, tt.targetPath)

			if tt.shouldSucceed {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}
