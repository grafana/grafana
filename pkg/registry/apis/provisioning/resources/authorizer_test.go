package resources

import (
	"context"
	"encoding/json"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
			parsed := &ParsedResource{
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

			authorizer := NewAuthorizer(repo, nil, mockAccess, false)
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
		name        string
		path        string
		repoName    string
		shouldAllow bool
		description string
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
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), mock.Anything).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()
			}

			authorizer := NewAuthorizer(repo, nil, mockAccess, false)
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

// TestAuthorizeDeleteByPath_Folders tests authorization checks for folder deletion via ByPath.
func TestAuthorizeDeleteByPath_Folders(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		repoName    string
		shouldAllow bool
		description string
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
			mockReader := repository.NewMockReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			// Mock Config() call for GetFolderID
			mockReader.On("Config").Return(repo)

			// Mock Read() call to simulate metadata not found (fallback to hash-based ID)
			mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
				Return(nil, repository.ErrFileNotFound).Maybe()

			// The folder context is the PARENT folder ID, not the folder's own ID
			expectedParentFolderID := RootFolder(repo) // Root-level folders have "" as parent

			if tt.shouldAllow {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbDelete &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), expectedParentFolderID).Return(nil).Once()
			} else {
				mockAccess.On("Check", mock.Anything, mock.Anything, expectedParentFolderID).Return(assert.AnError).Once()
			}

			authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
			err := authorizer.AuthorizeDeleteByPath(context.Background(), tt.path)

			if tt.shouldAllow {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeMoveByPath_Folders tests authorization checks for folder moves via ByPath.
func TestAuthorizeMoveByPath_Folders(t *testing.T) {
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
			mockReader := repository.NewMockReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.repoName,
				},
			}

			// Mock Config() call for GetFolderID
			mockReader.On("Config").Return(repo)

			// Mock Read() call to simulate metadata not found (fallback to hash-based ID)
			mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
				Return(nil, repository.ErrFileNotFound).Maybe()

			sourceFolderID := ParseFolder(tt.originalPath, tt.repoName).ID

			// Set up expectation for source folder update check
			if tt.allowSourceUpdate {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbUpdate &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
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
							req.Group == FolderResource.Group &&
							req.Resource == FolderResource.Resource
					}), mock.Anything).Return(nil).Once()
				} else {
					mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
						return req.Verb == utils.VerbCreate
					}), mock.Anything).Return(assert.AnError).Once()
				}
			}

			authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
			err := authorizer.AuthorizeMoveByPath(context.Background(), tt.originalPath, tt.targetPath)

			if tt.shouldSucceed {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeFolderMetadata tests authorization with folder metadata enabled
func TestAuthorizeFolderMetadata(t *testing.T) {
	tests := []struct {
		name           string
		setupReader    func(*testing.T) repository.Reader
		folderPath     string
		expectedFolder string
		shouldPass     bool
		description    string
	}{
		{
			name: "folder metadata exists - uses stable UID from _folder.json",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID calls (may be called multiple times for parent)
				rw.On("Config").Return(repo).Maybe()
				// Return folder metadata with stable UID
				folderMeta := NewFolderManifest("stable-uid-123", "my-folder", FolderKind)
				data, _ := json.Marshal(folderMeta)
				rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
					Return(&repository.FileInfo{Data: data}, nil)
				// Parent folder metadata doesn't exist (root)
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			folderPath:     "my-folder/",
			expectedFolder: "", // Root folder (parent of my-folder)
			shouldPass:     true,
			description:    "Should use stable UID from _folder.json when it exists",
		},
		{
			name: "folder metadata missing - falls back to hash-based ID",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID fallback (may be called multiple times)
				rw.On("Config").Return(repo).Maybe()
				// Return not found error for all _folder.json reads
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			folderPath:     "my-folder/",
			expectedFolder: "", // Root folder (parent of my-folder)
			shouldPass:     true,
			description:    "Should fall back to hash-based ID when _folder.json doesn't exist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			reader := tt.setupReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
			}

			// Set up expectation for the check with the expected folder ID
			if tt.shouldPass {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbDelete &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), tt.expectedFolder).Return(nil).Once()
			}

			authorizer := NewAuthorizer(repo, reader, mockAccess, true) // folderMetadataEnabled=true
			err := authorizer.AuthorizeDeleteByPath(context.Background(), tt.folderPath)

			if tt.shouldPass {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeCreateFolderWithMetadata tests parent folder ID resolution with metadata
func TestAuthorizeCreateFolderWithMetadata(t *testing.T) {
	tests := []struct {
		name             string
		setupReader      func(*testing.T) repository.Reader
		childPath        string
		expectedParentID string
		shouldPass       bool
		description      string
	}{
		{
			name: "parent has _folder.json - uses stable UID",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID calls (may be called multiple times)
				rw.On("Config").Return(repo).Maybe()
				// Parent folder metadata exists
				parentMeta := NewFolderManifest("parent-stable-uid", "parent", FolderKind)
				data, _ := json.Marshal(parentMeta)
				rw.On("Read", mock.Anything, "parent/_folder.json", "").
					Return(&repository.FileInfo{Data: data}, nil)
				// Other metadata reads fail
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			childPath:        "parent/child/",
			expectedParentID: "parent-stable-uid",
			shouldPass:       true,
			description:      "Should use parent's stable UID from _folder.json",
		},
		{
			name: "parent missing _folder.json - uses hash-based ID",
			setupReader: func(t *testing.T) repository.Reader {
				rw := repository.NewMockReaderWriter(t)
				repo := &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name: "test-repo",
					},
				}
				// Mock Config() for GetFolderID fallback (may be called multiple times)
				rw.On("Config").Return(repo).Maybe()
				// All metadata reads fail
				rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
					Return(nil, repository.ErrFileNotFound).Maybe()
				return rw
			},
			childPath:        "parent/child/",
			expectedParentID: ParseFolder("parent/", "test-repo").ID,
			shouldPass:       true,
			description:      "Should use hash-based parent ID when _folder.json missing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAccess := auth.NewMockAccessChecker(t)
			reader := tt.setupReader(t)
			repo := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
			}

			// Expect check on the parent folder
			if tt.shouldPass {
				mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
					return req.Verb == utils.VerbCreate &&
						req.Group == FolderResource.Group &&
						req.Resource == FolderResource.Resource
				}), tt.expectedParentID).Return(nil).Once()
			}

			authorizer := NewAuthorizer(repo, reader, mockAccess, true)
			err := authorizer.AuthorizeCreateFolder(context.Background(), tt.childPath)

			if tt.shouldPass {
				assert.NoError(t, err, tt.description)
			} else {
				assert.Error(t, err, tt.description)
			}
			mockAccess.AssertExpectations(t)
		})
	}
}

// TestAuthorizeMoveByPathWithMetadata tests folder move authorization with metadata
func TestAuthorizeMoveByPathWithMetadata(t *testing.T) {
	t.Run("both source and target use stable UIDs from metadata", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}

		// Mock Config() for GetFolderID calls (may be called multiple times)
		rw.On("Config").Return(repo).Maybe()

		// Source folder has metadata
		sourceMeta := NewFolderManifest("source-stable-uid", "source", FolderKind)
		sourceData, _ := json.Marshal(sourceMeta)
		rw.On("Read", mock.Anything, "source/_folder.json", "").
			Return(&repository.FileInfo{Data: sourceData}, nil)

		// Target parent has metadata
		targetParentMeta := NewFolderManifest("target-parent-stable-uid", "target-parent", FolderKind)
		targetParentData, _ := json.Marshal(targetParentMeta)
		rw.On("Read", mock.Anything, "target-parent/_folder.json", "").
			Return(&repository.FileInfo{Data: targetParentData}, nil)

		// Other metadata reads fail
		rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess := auth.NewMockAccessChecker(t)

		// Expect update check on source with stable UID
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), "source-stable-uid").Return(nil).Once()

		// Expect create check on target parent with stable UID
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), "target-parent-stable-uid").Return(nil).Once()

		authorizer := NewAuthorizer(repo, rw, mockAccess, true)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "source/", "target-parent/moved/")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
		rw.AssertExpectations(t)
	})
}

func TestAuthorizeReadAllSupported(t *testing.T) {
	t.Run("authorized - checks get on all supported resources at root", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range SupportedProvisioningResources {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbGet
			}), "").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, false)
		err := authorizer.AuthorizeReadAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on first resource - returns error immediately", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, nil, mockAccess, false)
		err := authorizer.AuthorizeReadAllSupported(context.Background())

		assert.Error(t, err)
	})
}

func TestAuthorizeCreateAllSupported(t *testing.T) {
	t.Run("folder sync target - checks create on all supported resources in target folder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range SupportedProvisioningResources {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbCreate
			}), "my-repo").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, false)
		err := authorizer.AuthorizeCreateAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("instance sync target - checks create at root", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		for _, kind := range SupportedProvisioningResources {
			mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
				return req.Group == kind.Group &&
					req.Resource == kind.Resource &&
					req.Verb == utils.VerbCreate
			}), "").Return(nil).Once()
		}

		authorizer := NewAuthorizer(repo, nil, mockAccess, false)
		err := authorizer.AuthorizeCreateAllSupported(context.Background())

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on create - returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "my-repo"},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, nil, mockAccess, false)
		err := authorizer.AuthorizeCreateAllSupported(context.Background())

		assert.Error(t, err)
	})
}

// dashboardFileInfo returns a FileInfo containing a classic dashboard JSON that
// ParseFileResource will recognise as a dashboard resource.
func dashboardFileInfo() *repository.FileInfo {
	return &repository.FileInfo{
		Data: []byte(`{"uid":"test","schemaVersion":7,"panels":[],"tags":[]}`),
	}
}

func TestAuthorizeDeleteByPath(t *testing.T) {
	t.Run("file path checks dashboard delete on parent folder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("root-level file checks dashboard delete on root folder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		rootFolder := RootFolder(repo)
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Read", mock.Anything, "dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), rootFolder).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "dashboard.json")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("directory path delegates to AuthorizeDeleteFolder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbDelete
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized file path returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "restricted/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "restricted/dashboard.json")

		assert.Error(t, err)
	})

	t.Run("non-existent file returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "unknown/file.json")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "read file")
	})

	t.Run("unsupported resource type returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "bad/widget.json", "").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"custom.example.io/v1","kind":"Widget","metadata":{"name":"w"}}`),
			}, nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "bad/widget.json")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported resource type")
	})

	t.Run("folder resource in file returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "sneaky/folder.json", "").
			Return(&repository.FileInfo{
				Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"f"},"spec":{"title":"F"}}`),
			}, nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "sneaky/folder.json")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported resource type")
	})

	t.Run("file path with folder metadata uses stable UID", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)

		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(repo).Maybe()
		parentMeta := NewFolderManifest("stable-folder-uid", "team-a", FolderKind)
		data, _ := json.Marshal(parentMeta)
		rw.On("Read", mock.Anything, "team-a/_folder.json", "").
			Return(&repository.FileInfo{Data: data}, nil)
		rw.On("Read", mock.Anything, "team-a/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		rw.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbDelete
		}), "stable-folder-uid").Return(nil).Once()

		authorizer := NewAuthorizer(repo, rw, mockAccess, true)
		err := authorizer.AuthorizeDeleteByPath(context.Background(), "team-a/dashboard.json")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})
}

func TestAuthorizeMoveByPath(t *testing.T) {
	t.Run("file path checks update on source and create on target", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "src/dashboard.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbUpdate
		}), mock.AnythingOfType("string")).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == DashboardResource.Group &&
				req.Resource == DashboardResource.Resource &&
				req.Verb == utils.VerbCreate
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dashboard.json", "dst/dashboard.json")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("directory path delegates to AuthorizeMoveFolder", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbUpdate
		}), mock.AnythingOfType("string")).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Group == FolderResource.Group &&
				req.Resource == FolderResource.Resource &&
				req.Verb == utils.VerbCreate
		}), mock.AnythingOfType("string")).Return(nil).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src-folder/", "dst-folder/")

		assert.NoError(t, err)
		mockAccess.AssertExpectations(t)
	})

	t.Run("unauthorized on source returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "restricted/dash.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "restricted/dash.json", "dest/dash.json")

		assert.Error(t, err)
	})

	t.Run("unauthorized on target returns error", func(t *testing.T) {
		repo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		}
		mockAccess := auth.NewMockAccessChecker(t)
		mockReader := repository.NewMockReader(t)
		mockReader.On("Config").Return(repo).Maybe()
		mockReader.On("Read", mock.Anything, "src/dash.json", "").
			Return(dashboardFileInfo(), nil)
		mockReader.On("Read", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, repository.ErrFileNotFound).Maybe()

		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbUpdate
		}), mock.Anything).Return(nil).Once()
		mockAccess.On("Check", mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate
		}), mock.Anything).Return(assert.AnError).Once()

		authorizer := NewAuthorizer(repo, mockReader, mockAccess, false)
		err := authorizer.AuthorizeMoveByPath(context.Background(), "src/dash.json", "restricted/dash.json")

		assert.Error(t, err)
	})
}
