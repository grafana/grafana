package repository

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	field "k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
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
	r := NewLocal(&v0alpha1.Repository{
		Spec: v0alpha1.RepositorySpec{
			Local: &v0alpha1.LocalRepositoryConfig{
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
			r := NewLocal(&v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Local: &v0alpha1.LocalRepositoryConfig{
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
			r := NewLocal(&v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Local: &v0alpha1.LocalRepositoryConfig{
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
				err := os.MkdirAll(testPath, 0755)
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
				err := os.MkdirAll(permittedPath, 0755)
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
