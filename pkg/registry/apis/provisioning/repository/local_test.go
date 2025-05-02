package repository

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

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func TestLocalResolver(t *testing.T) {
	resolver := &LocalFolderResolver{
		PermittedPrefixes: []string{
			"github",
		},
		HomePath: "./",
	}

	fullpath, err := resolver.LocalPath("github/testdata")
	require.NoError(t, err)
	require.Equal(t, "github/testdata", fullpath)

	_, err = resolver.LocalPath("something")
	require.Error(t, err)

	// Check valid errors
	r := NewLocal(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Local: &provisioning.LocalRepositoryConfig{
				Path: "github",
			},
		},
	}, resolver)

	// Full tree
	tree, err := r.ReadTree(context.Background(), "")
	require.NoError(t, err)
	names := []string{}
	for _, v := range tree {
		names = append(names, v.Path)
	}
	require.Equal(t, []string{
		"client.go",
		"factory.go",
		"impl.go",
		"impl_test.go",
		"mock_client.go",
		"mock_commit_file.go",
		"mock_repository_content.go",
		"testdata",
		"testdata/webhook-issue_comment-created.json",
		"testdata/webhook-ping-check.json",
		"testdata/webhook-pull_request-opened.json",
		"testdata/webhook-push-different_branch.json",
		"testdata/webhook-push-nested.json",
		"testdata/webhook-push-nothing_relevant.json",
	}, names)

	v, err := r.Read(context.Background(), "testdata", "")
	require.NoError(t, err)
	require.Equal(t, "testdata", v.Path)
	require.Nil(t, v.Data)

	v, err = r.Read(context.Background(), "testdata/webhook-push-nested.json", "")
	require.NoError(t, err)
	require.Equal(t, "4eb879daca9942a887862b3d76fe9f24528d0408", v.Hash)

	// read unknown file
	_, err = r.Read(context.Background(), "testdata/missing", "")
	require.True(t, apierrors.IsNotFound(err)) // 404 error

	_, err = r.Read(context.Background(), "testdata/webhook-push-nested.json/", "")
	require.Error(t, err) // not a directory
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
			r := NewLocal(&provisioning.Repository{
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
			r := NewLocal(&provisioning.Repository{
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
			repo := NewLocal(&provisioning.Repository{
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
			repo := NewLocal(repoConfig, resolver)

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
			expectedErr: ErrFileNotFound,
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
		expected    *FileInfo
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
			expected: &FileInfo{
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
			expectedErr: ErrFileNotFound,
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
			expected: &FileInfo{
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
		expected    []FileTreeEntry
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
			expected:    []FileTreeEntry{},
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
			expected: []FileTreeEntry{
				{Path: "file1.txt", Blob: true, Size: 8},
				{Path: "file2.txt", Blob: true, Size: 8},
				{Path: "subdir", Blob: false},
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
			expected:    []FileTreeEntry{},
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
