package local

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	field "k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestLocalResolver(t *testing.T) {
	// Create a temporary directory structure
	tempDir := t.TempDir()

	// Create directory structure with multiple levels
	dirs := []string{
		"level1",
		"level1/level2",
		"level1/level2/level3",
		"another/path",
	}

	for _, dir := range dirs {
		dirPath := filepath.Join(tempDir, dir)
		err := os.MkdirAll(dirPath, 0750)
		require.NoError(t, err)
	}

	// Create some files at different levels
	files := map[string]string{
		"root.txt":                       "root content",
		"level1/file1.txt":               "level 1 content",
		"level1/level2/file2.txt":        "level 2 content",
		"level1/level2/level3/file3.txt": "level 3 content",
		"another/path/file.txt":          "another path content",
	}

	for path, content := range files {
		filePath := filepath.Join(tempDir, path)
		err := os.WriteFile(filePath, []byte(content), 0644)
		require.NoError(t, err)
	}

	// Create resolver with the temp directory as permitted prefix
	resolver := &LocalFolderResolver{
		PermittedPrefixes: []string{tempDir},
		HomePath:          "./",
	}

	// Test resolving paths
	for _, dir := range dirs {
		fullPath, err := resolver.LocalPath(filepath.Join(tempDir, dir))
		require.NoError(t, err)
		require.Equal(t, filepath.Join(tempDir, dir), fullPath)
	}

	// Test repository with the temp directory
	repo := NewRepository(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Local: &provisioning.LocalRepositoryConfig{
				Path: tempDir,
			},
		},
	}, resolver)

	// Verify we can read the tree
	tree, err := repo.ReadTree(context.Background(), "")
	require.NoError(t, err)

	// Collect all paths from the tree
	paths := make([]string, 0, len(tree))
	for _, item := range tree {
		paths = append(paths, item.Path)
	}

	// Sort paths for consistent comparison
	sort.Strings(paths)

	// Verify all directories and files are present
	expectedPaths := []string{
		"another/",
		"another/path/",
		"another/path/file.txt",
		"level1/",
		"level1/file1.txt",
		"level1/level2/",
		"level1/level2/file2.txt",
		"level1/level2/level3/",
		"level1/level2/level3/file3.txt",
		"root.txt",
	}
	require.Equal(t, expectedPaths, paths)

	// Test reading a specific file
	file, err := repo.Read(context.Background(), "level1/level2/file2.txt", "")
	require.NoError(t, err)
	require.Equal(t, "level1/level2/file2.txt", file.Path)
	require.Equal(t, []byte("level 2 content"), file.Data)
}

func TestLocal(t *testing.T) {
	// Valid paths test cases
	for _, tc := range []struct {
		Name              string
		Path              string
		PermittedPrefixes []string
		ExpectedPath      string
	}{
		{"relative path", "devenv/test", []string{"/home/grafana"}, "/home/grafana/devenv/test/"},
		{"absolute path", "/devenv/test", []string{"/devenv"}, "/devenv/test/"},
		{"relative path with multiple prefixes", "devenv/test", []string{"/home/grafana", "/devenv"}, "/home/grafana/devenv/test/"},
		{"absolute path with multiple prefixes", "/devenv/test", []string{"/home/grafana", "/devenv"}, "/devenv/test/"},
	} {
		t.Run("valid: "+tc.Name, func(t *testing.T) {
			r := NewRepository(&provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Local: &provisioning.LocalRepositoryConfig{
						Path: tc.Path,
					},
				},
			}, &LocalFolderResolver{PermittedPrefixes: tc.PermittedPrefixes, HomePath: "/home/grafana"})

			assert.Equal(t, tc.ExpectedPath, r.path, "expected path to be resolved")
			for _, err := range r.Validate() {
				assert.Fail(t, "unexpected validation failure", "unexpected validation error on field %s: %s", err.Field, err.ErrorBody())
			}
		})
	}

	// Invalid paths test cases
	for _, tc := range []struct {
		Name              string
		Path              string
		PermittedPrefixes []string
	}{
		{"no configured paths", "invalid/path", nil},
		{"path traversal escape", "../../etc/passwd", []string{"/home/grafana"}},
		{"unconfigured prefix", "invalid/path", []string{"devenv", "/tmp", "test"}},
	} {
		t.Run("invalid: "+tc.Name, func(t *testing.T) {
			r := NewRepository(&provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Local: &provisioning.LocalRepositoryConfig{
						Path: tc.Path,
					},
				},
			}, &LocalFolderResolver{PermittedPrefixes: tc.PermittedPrefixes, HomePath: "/home/grafana"})

			require.Empty(t, r.path, "no path should be resolved")

			errs := r.Validate()
			require.NotEmpty(t, errs, "expected validation errors")
			for _, err := range errs {
				if !assert.Equal(t, "spec.local.path", err.Field) {
					assert.FailNow(t, "unexpected validation failure", "unexpected validation error on field %s: %s", err.Field, err.ErrorBody())
				}
			}
		})
	}
}

func TestLocalRepository_Test(t *testing.T) {
	// Test cases for the Test method
	testCases := []struct {
		name           string
		path           string
		pathExists     bool
		expectedCode   int
		expectedResult bool
	}{
		{
			name:           "valid path that exists",
			path:           "valid/path/",
			pathExists:     true,
			expectedCode:   http.StatusOK,
			expectedResult: true,
		},
		{
			name:           "valid path that doesn't exist",
			path:           "valid/nonexistent",
			pathExists:     false,
			expectedCode:   http.StatusBadRequest,
			expectedResult: false,
		},
		{
			name:           "invalid path with path traversal",
			path:           "../../../etc/passwd",
			pathExists:     false,
			expectedCode:   http.StatusBadRequest,
			expectedResult: false,
		},
		{
			name:           "invalid path with special characters",
			path:           "path/with/*/wildcards",
			pathExists:     false,
			expectedCode:   http.StatusBadRequest,
			expectedResult: false,
		},
		{
			name:           "empty path",
			path:           "",
			pathExists:     false,
			expectedCode:   http.StatusBadRequest,
			expectedResult: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a temporary directory for testing
			tempDir := t.TempDir()

			// Setup the test directory if needed
			testPath := filepath.Join(tempDir, tc.path)
			if tc.pathExists {
				err := os.MkdirAll(testPath, 0750)
				require.NoError(t, err, "Failed to create test directory")
			}

			// Create a resolver that permits the temp directory
			resolver := &LocalFolderResolver{
				PermittedPrefixes: []string{tempDir},
				HomePath:          tempDir,
			}

			// Create the repository with the test path
			repo := NewRepository(&provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Local: &provisioning.LocalRepositoryConfig{
						Path: tc.path,
					},
				},
			}, resolver)

			// If we're testing a valid path, set it to our test path
			if tc.path != "" {
				repo.path = testPath
			}

			// Call the Test method
			results, err := repo.Test(context.Background())

			// Verify results
			require.NoError(t, err, "Test method should not return an error")
			assert.Equal(t, tc.expectedResult, results.Success, "Success flag should match expected")
			assert.Equal(t, tc.expectedCode, results.Code, "Status code should match expected")
		})
	}
}

func TestLocalRepository_Validate(t *testing.T) {
	testCases := []struct {
		name          string
		config        *provisioning.LocalRepositoryConfig
		permittedPath string
		expectedErrs  []field.Error
	}{
		{
			name:          "valid configuration",
			config:        &provisioning.LocalRepositoryConfig{Path: "valid/path"},
			permittedPath: "valid",
			expectedErrs:  nil,
		},
		{
			name:          "missing local config",
			config:        nil,
			permittedPath: "valid",
			expectedErrs: []field.Error{
				{
					Type:  field.ErrorTypeRequired,
					Field: "spec.local",
				},
			},
		},
		{
			name:          "empty path",
			config:        &provisioning.LocalRepositoryConfig{Path: ""},
			permittedPath: "valid",
			expectedErrs: []field.Error{
				{
					Type:     field.ErrorTypeRequired,
					Field:    "spec.local.path",
					Detail:   "must enter a path to local file",
					BadValue: "",
				},
			},
		},
		{
			name:          "path not in permitted prefixes",
			config:        &provisioning.LocalRepositoryConfig{Path: "invalid/path"},
			permittedPath: "valid",
			expectedErrs: []field.Error{
				{
					Type:     field.ErrorTypeInvalid,
					Field:    "spec.local.path",
					BadValue: "invalid/path",
					Detail:   "the path given ('invalid/path') is invalid for a local repository (the path matches no permitted prefix)",
				},
			},
		},
		{
			name:          "unsafe path with directory traversal",
			config:        &provisioning.LocalRepositoryConfig{Path: "../../../etc/passwd"},
			permittedPath: "valid",
			expectedErrs: []field.Error{
				{
					Type:     field.ErrorTypeInvalid,
					Field:    "spec.local.path",
					BadValue: "../../../etc/passwd",
					Detail:   "path contains traversal attempt (./ or ../)",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a temporary directory for testing
			tempDir := t.TempDir()
			permittedPath := filepath.Join(tempDir, tc.permittedPath)

			// Create the permitted directory
			if tc.permittedPath != "" {
				err := os.MkdirAll(permittedPath, 0750)
				require.NoError(t, err, "Failed to create permitted directory")
			}

			// Create a resolver that permits the specific path
			resolver := &LocalFolderResolver{
				PermittedPrefixes: []string{permittedPath},
				HomePath:          tempDir,
			}

			// Create repository config
			repoConfig := &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Local: tc.config,
				},
			}

			// Create the repository
			repo := NewRepository(repoConfig, resolver)

			// Call the Validate method
			errors := repo.Validate()

			// Verify results
			if tc.expectedErrs == nil {
				assert.Empty(t, errors, "Expected no validation errors")
			} else {
				assert.Len(t, errors, len(tc.expectedErrs), "Number of validation errors should match expected")
				for i, expectedErr := range tc.expectedErrs {
					assert.Equal(t, expectedErr.Type, errors[i].Type, "Error type should match")
					assert.Equal(t, expectedErr.Field, errors[i].Field, "Error field should match")
					assert.Equal(t, expectedErr.Detail, errors[i].Detail, "Error detail should match")
					assert.Equal(t, expectedErr.BadValue, errors[i].BadValue, "Error bad value should match")
				}
			}
		})
	}
}

func TestInvalidLocalFolderError(t *testing.T) {
	testCases := []struct {
		name           string
		path           string
		additionalInfo string
		expectedMsg    string
		expectedStatus metav1.Status
	}{
		{
			name:           "basic error",
			path:           "/invalid/path",
			additionalInfo: "not allowed",
			expectedMsg:    "the path given ('/invalid/path') is invalid for a local repository (not allowed)",
			expectedStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Reason:  metav1.StatusReasonBadRequest,
				Message: "the path given ('/invalid/path') is invalid for a local repository (not allowed)",
			},
		},
		{
			name:           "empty path",
			path:           "",
			additionalInfo: "path cannot be empty",
			expectedMsg:    "the path given ('') is invalid for a local repository (path cannot be empty)",
			expectedStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Reason:  metav1.StatusReasonBadRequest,
				Message: "the path given ('') is invalid for a local repository (path cannot be empty)",
			},
		},
		{
			name:           "no permitted prefixes",
			path:           "/some/path",
			additionalInfo: "no permitted prefixes were configured",
			expectedMsg:    "the path given ('/some/path') is invalid for a local repository (no permitted prefixes were configured)",
			expectedStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusBadRequest,
				Reason:  metav1.StatusReasonBadRequest,
				Message: "the path given ('/some/path') is invalid for a local repository (no permitted prefixes were configured)",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create the error
			err := &InvalidLocalFolderError{
				Path:           tc.path,
				AdditionalInfo: tc.additionalInfo,
			}

			// Test Error() method
			assert.Equal(t, tc.expectedMsg, err.Error(), "Error message should match expected")

			// Test Status() method
			status := err.Status()
			assert.Equal(t, tc.expectedStatus.Status, status.Status, "Status should match")
			assert.Equal(t, tc.expectedStatus.Code, status.Code, "Status code should match")
			assert.Equal(t, tc.expectedStatus.Reason, status.Reason, "Status reason should match")
			assert.Equal(t, tc.expectedStatus.Message, status.Message, "Status message should match")

			// Verify it implements the expected interfaces
			var apiStatus apierrors.APIStatus
			assert.True(t, errors.As(err, &apiStatus), "Should implement APIStatus interface")
		})
	}
}

func TestLocalRepository_Delete(t *testing.T) {
	testCases := []struct {
		name        string
		setup       func(t *testing.T) (string, *localRepository)
		path        string
		ref         string
		comment     string
		expectedErr error
	}{
		{
			name: "delete existing file",
			setup: func(t *testing.T) (string, *localRepository) {
				// Create a temporary directory for testing
				tempDir := t.TempDir()

				// Create a test file
				testFilePath := filepath.Join(tempDir, "test-file.txt")
				err := os.WriteFile(testFilePath, []byte("test content"), 0600)
				require.NoError(t, err)

				// Create repository with the temp directory as permitted prefix
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "test-file.txt",
			ref:         "",
			comment:     "test delete",
			expectedErr: nil,
		},
		{
			name: "delete non-existent file",
			setup: func(t *testing.T) (string, *localRepository) {
				// Create a temporary directory for testing
				tempDir := t.TempDir()

				// Create repository with the temp directory as permitted prefix
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "non-existent-file.txt",
			ref:         "",
			comment:     "test delete non-existent",
			expectedErr: os.ErrNotExist,
		},
		{
			name: "delete with ref not supported",
			setup: func(t *testing.T) (string, *localRepository) {
				// Create a temporary directory for testing
				tempDir := t.TempDir()

				// Create repository with the temp directory as permitted prefix
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "test-file.txt",
			ref:         "main",
			comment:     "test delete with ref",
			expectedErr: apierrors.NewBadRequest("local repository does not support ref"),
		},
		{
			name: "delete folder with nested files",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				nestedFolderPath := filepath.Join(tempDir, "folder")
				err := os.MkdirAll(nestedFolderPath, 0700)
				require.NoError(t, err)
				subFolderPath := filepath.Join(nestedFolderPath, "nested-folder")
				err = os.MkdirAll(subFolderPath, 0700)
				require.NoError(t, err)
				err = os.WriteFile(filepath.Join(nestedFolderPath, "nested-dash.txt"), []byte("content1"), 0600)
				require.NoError(t, err)

				// Create repository with the temp directory as permitted prefix
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "folder/",
			ref:         "",
			comment:     "test delete folder with nested content",
			expectedErr: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			_, repo := tc.setup(t)

			// Execute the delete operation
			err := repo.Delete(context.Background(), tc.path, tc.ref, tc.comment)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				if errors.Is(tc.expectedErr, os.ErrNotExist) {
					assert.True(t, errors.Is(err, os.ErrNotExist), "Expected os.ErrNotExist error")
				} else {
					assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
				}
			} else {
				require.NoError(t, err)

				// Verify the file was actually deleted
				_, statErr := os.Stat(filepath.Join(repo.path, tc.path))
				assert.True(t, errors.Is(statErr, os.ErrNotExist), "File should be deleted")
			}
		})
	}
}

func TestLocalRepository_Update(t *testing.T) {
	testCases := []struct {
		name        string
		setup       func(t *testing.T) (string, *localRepository)
		path        string
		ref         string
		data        []byte
		comment     string
		expectedErr error
	}{
		{
			name: "update existing file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file to update
				filePath := filepath.Join(tempDir, "existing-file.txt")
				require.NoError(t, os.WriteFile(filePath, []byte("initial content"), 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "existing-file.txt",
			ref:         "",
			data:        []byte("updated content"),
			comment:     "",
			expectedErr: nil,
		},
		{
			name: "update existing directory as a file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a directory
				dirPath := filepath.Join(tempDir, "existing-dir")
				require.NoError(t, os.MkdirAll(dirPath, 0700))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "existing-dir",
			ref:         "",
			data:        []byte("file content"),
			comment:     "",
			expectedErr: apierrors.NewBadRequest("path exists but it is a directory"),
		},
		{
			name: "update non-existent file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "non-existent-file.txt",
			ref:         "",
			data:        []byte("content"),
			comment:     "",
			expectedErr: repository.ErrFileNotFound,
		},
		{
			name: "update directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a directory
				dirPath := filepath.Join(tempDir, "test-dir")
				require.NoError(t, os.MkdirAll(dirPath, 0700))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "test-dir/",
			ref:         "",
			data:        []byte("content"),
			comment:     "",
			expectedErr: apierrors.NewBadRequest("cannot update a directory"),
		},
		{
			name: "update with ref",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file to update
				filePath := filepath.Join(tempDir, "test-file.txt")
				require.NoError(t, os.WriteFile(filePath, []byte("initial content"), 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "test-file.txt",
			ref:         "main",
			data:        []byte("updated content"),
			comment:     "test update with ref",
			expectedErr: apierrors.NewBadRequest("local repository does not support ref"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			_, repo := tc.setup(t)

			// Execute the update operation
			err := repo.Update(context.Background(), tc.path, tc.ref, tc.data, tc.comment)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
			} else {
				require.NoError(t, err)

				// Verify the file was actually updated
				updatedContent, readErr := os.ReadFile(filepath.Join(repo.path, tc.path))
				require.NoError(t, readErr)
				assert.Equal(t, tc.data, updatedContent, "File content should be updated")
			}
		})
	}
}

func TestLocalRepository_Write(t *testing.T) {
	testCases := []struct {
		name        string
		setup       func(t *testing.T) (string, *localRepository)
		path        string
		ref         string
		data        []byte
		comment     string
		expectedErr error
	}{
		{
			name: "write new file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "new-file.txt",
			data:    []byte("new content"),
			comment: "test write new file",
		},
		{
			name: "overwrite existing file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file to be overwritten
				existingFilePath := filepath.Join(tempDir, "existing-file.txt")
				require.NoError(t, os.WriteFile(existingFilePath, []byte("original content"), 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "existing-file.txt",
			data:    []byte("updated content"),
			comment: "test overwrite existing file",
		},
		{
			name: "create directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "new-dir/",
			data:    nil,
			comment: "test create directory",
		},
		{
			name: "create file in nested directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "nested/dir/file.txt",
			data:    []byte("nested file content"),
			comment: "test create file in nested directory",
		},
		{
			name: "write with ref should fail",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "test-file.txt",
			ref:         "main",
			data:        []byte("content with ref"),
			comment:     "test write with ref",
			expectedErr: apierrors.NewBadRequest("local repository does not support ref"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			_, repo := tc.setup(t)

			// Execute the write operation
			err := repo.Write(context.Background(), tc.path, tc.ref, tc.data, tc.comment)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
			} else {
				require.NoError(t, err)

				// Verify the file or directory was created
				targetPath := filepath.Join(repo.path, tc.path)

				// Check if it's a directory
				if strings.HasSuffix(tc.path, "/") || tc.data == nil {
					info, statErr := os.Stat(targetPath)
					require.NoError(t, statErr)
					assert.True(t, info.IsDir(), "Path should be a directory")
				} else {
					// Verify file content
					//nolint:gosec
					content, readErr := os.ReadFile(targetPath)
					require.NoError(t, readErr)
					assert.Equal(t, tc.data, content, "File content should match written data")
				}
			}
		})
	}
}

func TestLocalRepository_Create(t *testing.T) {
	testCases := []struct {
		name        string
		setup       func(t *testing.T) (string, *localRepository)
		path        string
		ref         string
		data        []byte
		comment     string
		expectedErr error
	}{
		{
			name: "create new file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "new-file.txt",
			data:    []byte("new content"),
			comment: "test create new file",
		},
		{
			name: "create file in nested directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "nested/dir/new-file.txt",
			data:    []byte("nested content"),
			comment: "test create file in nested directory",
		},
		{
			name: "create directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:    "new-dir/",
			data:    nil,
			comment: "test create directory",
		},
		{
			name: "create file that already exists",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file that will conflict
				existingFilePath := filepath.Join(tempDir, "existing-file.txt")
				require.NoError(t, os.WriteFile(existingFilePath, []byte("original content"), 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "existing-file.txt",
			data:        []byte("new content"),
			comment:     "test create existing file",
			expectedErr: apierrors.NewAlreadyExists(schema.GroupResource{}, "existing-file.txt"),
		},
		{
			name: "create directory with data",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "invalid-dir/",
			data:        []byte("directory with data"),
			comment:     "test create directory with data",
			expectedErr: apierrors.NewBadRequest("data cannot be provided for a directory"),
		},
		{
			name: "create with ref",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "file-with-ref.txt",
			ref:         "main",
			data:        []byte("content with ref"),
			comment:     "test create with ref",
			expectedErr: apierrors.NewBadRequest("local repository does not support ref"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			_, repo := tc.setup(t)

			// Execute the create operation
			err := repo.Create(context.Background(), tc.path, tc.ref, tc.data, tc.comment)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
			} else {
				require.NoError(t, err)

				// Verify the file or directory was created
				targetPath := filepath.Join(repo.path, tc.path)

				// Check if it's a directory
				if strings.HasSuffix(tc.path, "/") || tc.data == nil {
					info, statErr := os.Stat(targetPath)
					require.NoError(t, statErr)
					assert.True(t, info.IsDir(), "Path should be a directory")
				} else {
					// Verify file content
					//nolint:gosec
					content, readErr := os.ReadFile(targetPath)
					require.NoError(t, readErr)
					assert.Equal(t, tc.data, content, "File content should match written data")
				}
			}
		})
	}
}

func TestLocalRepository_Read(t *testing.T) {
	testCases := []struct {
		name        string
		setup       func(t *testing.T) (string, *localRepository)
		path        string
		ref         string
		expectedErr error
		expected    *repository.FileInfo
	}{
		{
			name: "read existing file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file to read
				filePath := filepath.Join(tempDir, "test-file.txt")
				fileContent := []byte("test content")
				require.NoError(t, os.WriteFile(filePath, fileContent, 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path: "test-file.txt",
			expected: &repository.FileInfo{
				Path:     "test-file.txt",
				Modified: &metav1.Time{Time: time.Now()},
				Data:     []byte("test content"),
				Hash:     "1eebdf4fdc9fc7bf283031b93f9aef3338de9052",
			},
		},
		{
			name: "read non-existent file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "non-existent-file.txt",
			expectedErr: repository.ErrFileNotFound,
		},
		{
			name: "read with ref should fail",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file to read
				filePath := filepath.Join(tempDir, "test-file.txt")
				fileContent := []byte("test content")
				require.NoError(t, os.WriteFile(filePath, fileContent, 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path:        "test-file.txt",
			ref:         "main",
			expectedErr: apierrors.NewBadRequest("local repository does not support ref"),
		},
		{
			name: "read existing directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a directory to read
				dirPath := filepath.Join(tempDir, "test-dir")
				require.NoError(t, os.Mkdir(dirPath, 0750))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			path: "test-dir",
			expected: &repository.FileInfo{
				Path:     "test-dir",
				Modified: &metav1.Time{Time: time.Now()},
			},
			expectedErr: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			_, repo := tc.setup(t)

			// Execute the read operation
			data, err := repo.Read(context.Background(), tc.path, tc.ref)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.expected.Path, data.Path, "Path should match expected")
				assert.NotNil(t, data.Modified, "Modified time should not be nil")
				assert.Equal(t, tc.expected.Data, data.Data, "Data should match expected")
				assert.Equal(t, tc.expected.Hash, data.Hash, "Hash should match expected")
				assert.Empty(t, data.Ref, "Ref should be empty")
			}
		})
	}
}

func TestLocalRepository_ReadTree(t *testing.T) {
	testCases := []struct {
		name        string
		setup       func(t *testing.T) (string, *localRepository)
		ref         string
		expectedErr error
		expected    []repository.FileTreeEntry
	}{
		{
			name: "read empty directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			expected:    []repository.FileTreeEntry{},
			expectedErr: nil,
		},
		{
			name: "read directory with files",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create a file structure
				require.NoError(t, os.WriteFile(filepath.Join(tempDir, "file1.txt"), []byte("content1"), 0600))
				require.NoError(t, os.WriteFile(filepath.Join(tempDir, "file2.txt"), []byte("content2"), 0600))
				require.NoError(t, os.MkdirAll(filepath.Join(tempDir, "subdir"), 0700))
				require.NoError(t, os.WriteFile(filepath.Join(tempDir, "subdir", "file3.txt"), []byte("content3"), 0600))

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			expected: []repository.FileTreeEntry{
				{Path: "file1.txt", Blob: true, Size: 8},
				{Path: "file2.txt", Blob: true, Size: 8},
				{Path: "subdir/", Blob: false},
				{Path: "subdir/file3.txt", Blob: true, Size: 8},
			},
			expectedErr: nil,
		},
		{
			name: "read with ref",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			ref:         "main",
			expectedErr: apierrors.NewBadRequest("local repository does not support ref"),
		},
		{
			name: "read non-existent directory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()
				nonExistentDir := filepath.Join(tempDir, "non-existent")

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: nonExistentDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: nonExistentDir,
				}

				return tempDir, repo
			},
			expected:    []repository.FileTreeEntry{},
			expectedErr: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			_, repo := tc.setup(t)

			// Execute the readTree operation
			entries, err := repo.ReadTree(context.Background(), tc.ref)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
			} else {
				require.NoError(t, err)

				if len(tc.expected) == 0 {
					assert.Empty(t, entries, "Expected empty entries")
				} else {
					// Sort both expected and actual entries by path for comparison
					sort.Slice(entries, func(i, j int) bool {
						return entries[i].Path < entries[j].Path
					})

					// We need to verify each entry individually since hash values will be different
					assert.Equal(t, len(tc.expected), len(entries), "Number of entries should match")

					for i, expected := range tc.expected {
						if i < len(entries) {
							assert.Equal(t, expected.Path, entries[i].Path, "Path should match")
							assert.Equal(t, expected.Blob, entries[i].Blob, "Blob flag should match")

							if expected.Blob {
								assert.Equal(t, expected.Size, entries[i].Size, "Size should match")
								assert.NotEmpty(t, entries[i].Hash, "Hash should not be empty for files")
							}
						}
					}
				}
			}
		})
	}
}

func TestLocalRepository_Config(t *testing.T) {
	testCases := []struct {
		name   string
		config *provisioning.Repository
	}{
		{
			name: "returns the same config that was provided",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Local: &provisioning.LocalRepositoryConfig{
						Path: "/some/path",
					},
				},
			},
		},
		{
			name:   "returns nil config",
			config: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create repository with the test config
			repo := &localRepository{
				config: tc.config,
			}

			// Call the Config method
			result := repo.Config()

			// Verify the result is the same as the input config
			assert.Equal(t, tc.config, result, "Config() should return the same config that was provided")
		})
	}
}

func TestLocalRepository_Move(t *testing.T) {
	testCases := []struct {
		name            string
		setup           func(t *testing.T) (string, *localRepository)
		oldPath         string
		newPath         string
		ref             string
		comment         string
		expectedErr     error
		expectedContent string // Expected content of moved file (empty string means don't verify content)
	}{
		{
			name: "successful move",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create source file
				sourceFile := filepath.Join(tempDir, "source.txt")
				err := os.WriteFile(sourceFile, []byte("source content"), 0600)
				require.NoError(t, err)

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "source.txt",
			newPath:         "destination.txt",
			ref:             "",
			comment:         "move file",
			expectedErr:     nil,
			expectedContent: "source content",
		},
		{
			name: "move to subdirectory",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create source file
				sourceFile := filepath.Join(tempDir, "test.txt")
				err := os.WriteFile(sourceFile, []byte("test content"), 0600)
				require.NoError(t, err)

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "test.txt",
			newPath:         "newdir/moved.txt",
			ref:             "",
			comment:         "move to subdir",
			expectedErr:     nil,
			expectedContent: "test content",
		},
		{
			name: "move non-existent file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "nonexistent.txt",
			newPath:         "destination.txt",
			ref:             "",
			comment:         "move missing",
			expectedErr:     repository.ErrFileNotFound,
			expectedContent: "", // No content verification for error cases
		},
		{
			name: "move to existing file",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create source and destination files
				sourceFile := filepath.Join(tempDir, "source2.txt")
				destFile := filepath.Join(tempDir, "dest2.txt")

				err := os.WriteFile(sourceFile, []byte("source"), 0600)
				require.NoError(t, err)
				err = os.WriteFile(destFile, []byte("destination"), 0600)
				require.NoError(t, err)

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "source2.txt",
			newPath:         "dest2.txt",
			ref:             "",
			comment:         "move to existing",
			expectedErr:     repository.ErrFileAlreadyExists,
			expectedContent: "", // No content verification for error cases
		},
		{
			name: "successful directory move",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create directory with files
				subdir := filepath.Join(tempDir, "subdir")
				err := os.MkdirAll(subdir, 0700)
				require.NoError(t, err)

				// Add a file inside the directory
				err = os.WriteFile(filepath.Join(subdir, "file.txt"), []byte("dir content"), 0600)
				require.NoError(t, err)

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "subdir/",
			newPath:         "newsubdir/",
			ref:             "",
			comment:         "move directory",
			expectedErr:     nil,
			expectedContent: "", // No content verification for directory moves
		},
		{
			name: "move file to directory type should fail",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create source file
				sourceFile := filepath.Join(tempDir, "file.txt")
				err := os.WriteFile(sourceFile, []byte("content"), 0600)
				require.NoError(t, err)

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "file.txt",
			newPath:         "directory/",
			ref:             "",
			comment:         "move file to directory",
			expectedErr:     apierrors.NewBadRequest("cannot move between file and directory types"),
			expectedContent: "", // No content verification for error cases
		},
		{
			name: "move with ref should fail",
			setup: func(t *testing.T) (string, *localRepository) {
				tempDir := t.TempDir()

				// Create test file
				testFile := filepath.Join(tempDir, "ref_test.txt")
				err := os.WriteFile(testFile, []byte("ref test content"), 0600)
				require.NoError(t, err)

				repo := &localRepository{
					config: &provisioning.Repository{
						Spec: provisioning.RepositorySpec{
							Local: &provisioning.LocalRepositoryConfig{
								Path: tempDir,
							},
						},
					},
					resolver: &LocalFolderResolver{
						PermittedPrefixes: []string{tempDir},
					},
					path: tempDir,
				}

				return tempDir, repo
			},
			oldPath:         "ref_test.txt",
			newPath:         "ref_dest.txt",
			ref:             "some-ref",
			comment:         "move with ref",
			expectedErr:     apierrors.NewBadRequest("local repository does not support ref"),
			expectedContent: "", // No content verification for error cases
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Setup test environment
			tempDir, repo := tc.setup(t)

			// Execute the move operation
			err := repo.Move(context.Background(), tc.oldPath, tc.newPath, tc.ref, tc.comment)

			// Verify results
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr.Error(), err.Error(), "Error message should match expected")
			} else {
				require.NoError(t, err)

				// Verify source file no longer exists
				sourceFullPath := filepath.Join(tempDir, tc.oldPath)
				_, err = os.Stat(sourceFullPath)
				assert.True(t, errors.Is(err, os.ErrNotExist), "Source file should no longer exist")

				// Verify destination file exists
				destFullPath := filepath.Join(tempDir, tc.newPath)
				_, err = os.Stat(destFullPath)
				require.NoError(t, err, "Destination file should exist")

				// Verify content if expectedContent is specified
				if tc.expectedContent != "" {
					//nolint:gosec // G304: is only for tests
					content, err := os.ReadFile(destFullPath)
					require.NoError(t, err)
					assert.Equal(t, tc.expectedContent, string(content), "Content should be preserved")
				}
			}
		})
	}
}
