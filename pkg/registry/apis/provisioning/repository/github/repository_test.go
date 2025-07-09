package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	field "k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

func TestNewGitHub(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		setupMock     func(m *secrets.MockService)
		expectedError string
		expectedRepo  *githubRepository
	}{
		{
			name: "successful creation with token",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Token:  "token123",
						Branch: "main",
					},
				},
			},
			setupMock: func(m *secrets.MockService) {
				// No mock calls expected since we're using the token directly
			},
			expectedError: "",
			expectedRepo: &githubRepository{
				owner: "grafana",
				repo:  "grafana",
			},
		},
		{
			name: "successful creation with encrypted token",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:            "https://github.com/grafana/grafana",
						EncryptedToken: []byte("encrypted-token"),
						Branch:         "main",
					},
				},
			},
			setupMock: func(m *secrets.MockService) {
				m.On("Decrypt", mock.Anything, []byte("encrypted-token")).
					Return([]byte("decrypted-token"), nil)
			},
			expectedError: "",
			expectedRepo: &githubRepository{
				owner: "grafana",
				repo:  "grafana",
			},
		},
		{
			name: "error decrypting token",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:            "https://github.com/grafana/grafana",
						EncryptedToken: []byte("encrypted-token"),
						Branch:         "main",
					},
				},
			},
			setupMock: func(m *secrets.MockService) {
				m.On("Decrypt", mock.Anything, []byte("encrypted-token")).
					Return(nil, fmt.Errorf("decryption error"))
			},
			expectedError: "decrypt token: decryption error",
		},
		{
			name: "invalid URL format",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "invalid-url",
						Token:  "token123",
						Branch: "main",
					},
				},
			},
			setupMock: func(m *secrets.MockService) {
				// No mock calls expected
			},
			expectedError: "parse owner and repo",
			expectedRepo: &githubRepository{
				owner: "",
				repo:  "",
			},
		},
		{
			name: "URL with .git extension",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Token:  "token123",
						Branch: "main",
					},
				},
			},
			setupMock: func(m *secrets.MockService) {
				// No mock calls expected
			},
			expectedError: "",
			expectedRepo: &githubRepository{
				owner: "grafana",
				repo:  "grafana",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mocks
			mockSecrets := secrets.NewMockService(t)
			if tt.setupMock != nil {
				tt.setupMock(mockSecrets)
			}

			factory := ProvideFactory()
			factory.Client = http.DefaultClient

			gitRepo := git.NewMockGitRepository(t)

			// Call the function under test
			repo, err := NewGitHub(
				context.Background(),
				tt.config,
				gitRepo,
				factory,
				mockSecrets,
			)

			// Check results
			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, repo)
			} else {
				require.NoError(t, err)
				require.NotNil(t, repo)
				assert.Equal(t, tt.expectedRepo.owner, repo.Owner())
				assert.Equal(t, tt.expectedRepo.repo, repo.Repo())
				assert.Equal(t, tt.config, repo.Config())
				concreteRepo, ok := repo.(*githubRepository)
				require.True(t, ok)
				assert.Equal(t, gitRepo, concreteRepo.gitRepo)
			}

			// Verify all mock expectations were met
			mockSecrets.AssertExpectations(t)
		})
	}
}

func TestGitHubRepositoryValidate(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		expectedErrors int
		errorFields    []string
	}{
		{
			name: "Valid configuration",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 0,
		},
		{
			name: "Valid configuration with .git suffix",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana.git",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 0,
		},
		{
			name: "Missing GitHub config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: nil,
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github"},
		},
		{
			name: "Missing URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "Invalid URL format",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "invalid-url",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "Fail to parse URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/user%",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "URL not starting with https://github.com/",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://gitlab.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "Missing repo name",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana",
						Branch: "main",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.url"},
		},
		{
			name: "Missing branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.branch"},
		},
		{
			name: "Invalid branch name",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "feature//invalid",
						Token:  "valid-token",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.branch"},
		},
		{
			name: "Missing token",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "",
						Path:   "dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.token"},
		},
		{
			name: "Unsafe path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
						Path:   "../dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.prefix"},
		},
		{
			name: "Absolute path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
						Path:   "/dashboards",
					},
				},
			},
			expectedErrors: 1,
			errorFields:    []string{"spec.github.prefix"},
		},
		{
			name: "Multiple errors",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "",
						Branch: "",
						Token:  "",
						Path:   "/dashboards",
					},
				},
			},
			expectedErrors: 4,
			errorFields:    []string{"spec.github.url", "spec.github.branch", "spec.github.token", "spec.github.prefix"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a GitHub repository with the test config
			repo := &githubRepository{
				config: tt.config,
			}

			// Validate the configuration
			errors := repo.Validate()

			// Check the number of errors
			assert.Equal(t, tt.expectedErrors, len(errors), "Expected %d errors, got %d, errors: %v", tt.expectedErrors, len(errors), errors)

			// If we expect errors, check that they are for the right fields
			if tt.expectedErrors > 0 {
				errorFields := make([]string, 0, len(errors))
				for _, err := range errors {
					errorFields = append(errorFields, err.Field)
				}
				for _, expectedField := range tt.errorFields {
					assert.Contains(t, errorFields, expectedField, "Expected error for field %s", expectedField)
				}
			}
		})
	}
}

func TestGitHubRepository_Test(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		mockSetup      func(t *testing.T, client *MockClient)
		expectedResult *provisioning.TestResults
		expectedError  error
	}{
		{
			name: "Authentication failure",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "invalid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(errors.New("authentication failed"))
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.github.token",
					Detail: "authentication failed",
				}},
			},
			expectedError: nil,
		},
		{
			name: "Invalid URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/invalid",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "spec.github.url",
					Detail: "unable to parse repo+owner from url",
				}},
			},
			expectedError: nil,
		},
		{
			name: "Failed to check if repo exists",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/nonexistent",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
				client.On("RepoExists", mock.Anything, "grafana", "nonexistent").Return(false, errors.New("failed to check if repo exists"))
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseType(field.ErrorTypeInvalid),
					Field:  "spec.github.url",
					Detail: "failed to check if repo exists",
				}},
			},
			expectedError: nil,
		},
		{
			name: "Repository does not exist",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/nonexistent",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
				client.On("RepoExists", mock.Anything, "grafana", "nonexistent").Return(false, nil)
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:  metav1.CauseType(field.ErrorTypeNotFound),
					Field: "spec.github.url",
				}},
			},
			expectedError: nil,
		},
		{
			name: "Branch does not exist",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "nonexistent-branch",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
				client.On("RepoExists", mock.Anything, "grafana", "grafana").Return(true, nil)
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "nonexistent-branch").Return(false, nil)
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:  metav1.CauseType(field.ErrorTypeNotFound),
					Field: "spec.github.branch",
				}},
			},
			expectedError: nil,
		},
		{
			name: "Branch check error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
				client.On("RepoExists", mock.Anything, "grafana", "grafana").Return(true, nil)
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "main").Return(false, errors.New("API rate limit exceeded"))
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseType(field.ErrorTypeInvalid),
					Field:  "spec.github.branch",
					Detail: "API rate limit exceeded",
				}},
			},
			expectedError: nil,
		},
		{
			name: "Successful test",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
						Token:  "valid-token",
					},
				},
			},
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
				client.On("RepoExists", mock.Anything, "grafana", "grafana").Return(true, nil)
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "main").Return(true, nil)
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusOK,
				Success: true,
			},
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock GitHub client
			mockClient := NewMockClient(t)

			// Set up the mock expectations
			if tt.mockSetup != nil {
				tt.mockSetup(t, mockClient)
			}

			// Create a GitHub repository with the test config and mock client
			repo := &githubRepository{
				config: tt.config,
				gh:     mockClient,
				owner:  "grafana",
				repo:   "grafana",
			}

			// If the config has a different URL, parse and set the owner/repo
			if tt.config.Spec.GitHub.URL != "https://github.com/grafana/grafana" {
				owner, githubRepo, _ := ParseOwnerRepoGithub(tt.config.Spec.GitHub.URL)
				repo.owner = owner
				repo.repo = githubRepo
			}

			// Test the repository
			result, err := repo.Test(context.Background())

			// Check the error
			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			if tt.expectedResult != nil {
				assert.Equal(t, tt.expectedResult.Code, result.Code)
				assert.Equal(t, tt.expectedResult.Success, result.Success)

				if len(tt.expectedResult.Errors) > 0 {
					assert.Equal(t, len(tt.expectedResult.Errors), len(result.Errors))

					for i, expectedError := range tt.expectedResult.Errors {
						assert.Equal(t, expectedError.Type, result.Errors[i].Type)
						assert.Equal(t, expectedError.Field, result.Errors[i].Field)
						assert.Equal(t, expectedError.Detail, result.Errors[i].Detail)
					}
				}
			}

			// Verify all expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestReadTree(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		ref           string
		expectedRef   string
		tree          []RepositoryContent
		expected      []repository.FileTreeEntry
		getTreeErr    error
		truncated     bool
		expectedError error
	}{
		{name: "empty ref", ref: "", expectedRef: "develop", tree: []RepositoryContent{}, expected: []repository.FileTreeEntry{}},
		{name: "unknown error to get tree", ref: "develop", expectedRef: "develop", tree: []RepositoryContent{}, getTreeErr: errors.New("unknown error"), expectedError: errors.New("get tree: unknown error")},
		{name: "tree not found error", ref: "develop", expectedRef: "develop", tree: []RepositoryContent{}, getTreeErr: ErrResourceNotFound, expectedError: &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "tree not found; ref=develop",
				Code:    http.StatusNotFound,
			},
		}},
		{name: "tree truncated", ref: "develop", expectedRef: "develop", tree: []RepositoryContent{}, truncated: true, expectedError: errors.New("tree truncated")},
		{name: "empty tree", ref: "develop", expectedRef: "develop", tree: []RepositoryContent{}, expected: []repository.FileTreeEntry{}},
		{name: "single file", ref: "develop", expectedRef: "develop", tree: func() []RepositoryContent {
			content := NewMockRepositoryContent(t)
			content.EXPECT().GetPath().Return("file.txt")
			content.EXPECT().GetSize().Return(int64(100))
			content.EXPECT().GetSHA().Return("abc123")
			content.EXPECT().IsDirectory().Return(false)
			return []RepositoryContent{content}
		}(), expected: []repository.FileTreeEntry{
			{Path: "file.txt", Size: 100, Hash: "abc123", Blob: true},
		}},
		{name: "single directory", ref: "develop", expectedRef: "develop", tree: func() []RepositoryContent {
			content := NewMockRepositoryContent(t)
			content.EXPECT().GetPath().Return("dir")
			content.EXPECT().IsDirectory().Return(true)
			content.EXPECT().GetSize().Return(int64(0))
			content.EXPECT().GetSHA().Return("")

			return []RepositoryContent{content}
		}(), expected: []repository.FileTreeEntry{
			{Path: "dir/", Blob: false},
		}},
		{name: "mixed content", ref: "develop", expectedRef: "develop", tree: func() []RepositoryContent {
			file1 := NewMockRepositoryContent(t)
			file1.EXPECT().GetPath().Return("file1.txt")
			file1.EXPECT().GetSize().Return(int64(100))
			file1.EXPECT().GetSHA().Return("abc123")
			file1.EXPECT().IsDirectory().Return(false)

			dir := NewMockRepositoryContent(t)
			dir.EXPECT().GetPath().Return("dir")
			dir.EXPECT().IsDirectory().Return(true)
			dir.EXPECT().GetSize().Return(int64(0))
			dir.EXPECT().GetSHA().Return("")

			file2 := NewMockRepositoryContent(t)
			file2.EXPECT().GetPath().Return("file2.txt")
			file2.EXPECT().GetSize().Return(int64(200))
			file2.EXPECT().GetSHA().Return("def456")
			file2.EXPECT().IsDirectory().Return(false)

			return []RepositoryContent{file1, dir, file2}
		}(), expected: []repository.FileTreeEntry{
			{Path: "file1.txt", Size: 100, Hash: "abc123", Blob: true},
			{Path: "dir/", Blob: false},
			{Path: "file2.txt", Size: 200, Hash: "def456", Blob: true},
		}},
		{name: "with path prefix", ref: "develop", expectedRef: "develop", tree: func() []RepositoryContent {
			file := NewMockRepositoryContent(t)
			file.EXPECT().GetPath().Return("file.txt")
			file.EXPECT().GetSize().Return(int64(100))
			file.EXPECT().GetSHA().Return("abc123")
			file.EXPECT().IsDirectory().Return(false)

			dir := NewMockRepositoryContent(t)
			dir.EXPECT().GetPath().Return("dir")
			dir.EXPECT().GetSize().Return(int64(0))
			dir.EXPECT().GetSHA().Return("")
			dir.EXPECT().IsDirectory().Return(true)

			return []RepositoryContent{file, dir}
		}(), expected: []repository.FileTreeEntry{
			{Path: "file.txt", Size: 100, Hash: "abc123", Blob: true},
			{Path: "dir/", Blob: false},
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghMock := NewMockClient(t)
			gh := &githubRepository{
				owner: "owner",
				repo:  "repo",
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							Path:   tt.path,
							Branch: "develop",
						},
					},
				},
				gh: ghMock,
			}

			ghMock.On("GetTree", mock.Anything, "owner", "repo", tt.path, tt.expectedRef, true).Return(tt.tree, tt.truncated, tt.getTreeErr)
			tree, err := gh.ReadTree(context.Background(), tt.ref)
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, tree)
			}
		})
	}
}

func TestGitHubRepository_Read(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		filePath       string
		ref            string
		mockSetup      func(t *testing.T, client *MockClient)
		expectedResult *repository.FileInfo
		expectedError  error
	}{
		{
			name: "File found successfully",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "configs",
						Branch: "main",
					},
				},
			},
			filePath: "dashboard.json",
			ref:      "main",
			mockSetup: func(t *testing.T, client *MockClient) {
				fileContent := NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("file content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "main").
					Return(fileContent, nil, nil)
			},
			expectedResult: &repository.FileInfo{
				Path: "dashboard.json",
				Ref:  "main",
				Data: []byte("file content"),
				Hash: "abc123",
			},
			expectedError: nil,
		},
		{
			name: "Directory found successfully",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "configs",
						Branch: "main",
					},
				},
			},
			filePath: "dashboards",
			ref:      "main",
			mockSetup: func(t *testing.T, client *MockClient) {
				dirContent := []RepositoryContent{
					// Directory contents not used in this test
				}
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboards", "main").
					Return(nil, dirContent, nil)
			},
			expectedResult: &repository.FileInfo{
				Path: "dashboards",
				Ref:  "main",
			},
			expectedError: nil,
		},
		{
			name: "File not found",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "configs",
						Branch: "main",
					},
				},
			},
			filePath: "nonexistent.json",
			ref:      "main",
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/nonexistent.json", "main").
					Return(nil, nil, ErrResourceNotFound)
			},
			expectedResult: nil,
			expectedError:  repository.ErrFileNotFound,
		},
		{
			name: "Error getting file content",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "configs",
						Branch: "main",
					},
				},
			},
			filePath: "dashboard.json",
			ref:      "main",
			mockSetup: func(t *testing.T, client *MockClient) {
				fileContent := NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("", errors.New("failed to decode content"))
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "main").
					Return(fileContent, nil, nil)
			},
			expectedResult: nil,
			expectedError:  fmt.Errorf("get content: %w", errors.New("failed to decode content")),
		},
		{
			name: "GitHub API error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "configs",
						Branch: "main",
					},
				},
			},
			filePath: "dashboard.json",
			ref:      "main",
			mockSetup: func(t *testing.T, client *MockClient) {
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "main").
					Return(nil, nil, errors.New("API rate limit exceeded"))
			},
			expectedResult: nil,
			expectedError:  fmt.Errorf("get contents: %w", errors.New("API rate limit exceeded")),
		},
		{
			name: "Use default branch when ref is empty",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "configs",
						Branch: "develop",
					},
				},
			},
			filePath: "dashboard.json",
			ref:      "", // Empty ref should use default branch
			mockSetup: func(t *testing.T, client *MockClient) {
				fileContent := NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("file content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "develop").
					Return(fileContent, nil, nil)
			},
			expectedResult: &repository.FileInfo{
				Path: "dashboard.json",
				Ref:  "develop",
				Data: []byte("file content"),
				Hash: "abc123",
			},
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock GitHub client
			mockClient := NewMockClient(t)

			// Set up the mock expectations
			if tt.mockSetup != nil {
				tt.mockSetup(t, mockClient)
			}

			// Create a GitHub repository with the test config and mock client
			repo := &githubRepository{
				config: tt.config,
				gh:     mockClient,
				owner:  "grafana",
				repo:   "grafana",
			}

			// Call the Read method
			result, err := repo.Read(context.Background(), tt.filePath, tt.ref)

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.expectedError, &statusErr) {
					var actualStatusErr *apierrors.StatusError
					require.True(t, errors.As(err, &actualStatusErr), "Expected StatusError but got different error type")
					require.Equal(t, statusErr.Status().Code, actualStatusErr.Status().Code)
					require.Equal(t, statusErr.Status().Message, actualStatusErr.Status().Message)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
			} else {
				require.NoError(t, err)
			}

			// Check the result
			if tt.expectedResult != nil {
				require.Equal(t, tt.expectedResult.Path, result.Path)
				require.Equal(t, tt.expectedResult.Ref, result.Ref)
				require.Equal(t, tt.expectedResult.Data, result.Data)
				require.Equal(t, tt.expectedResult.Hash, result.Hash)
			} else {
				require.Nil(t, result)
			}

			// Verify all mock expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_Create(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		data          []byte
		comment       string
		mockSetup     func(t *testing.T, gitRepo *git.MockGitRepository)
		expectedError error
	}{
		{
			name: "delegates create to nanoGit",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "base/path",
					},
				},
			},
			path:    "test/file.txt",
			ref:     "feature-branch",
			data:    []byte("file content"),
			comment: "Add test file",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Create", mock.Anything, "test/file.txt", "feature-branch", []byte("file content"), "Add test file").
					Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "returns error from nanoGit",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "",
					},
				},
			},
			path:    "fail/file.txt",
			ref:     "main",
			data:    []byte("bad content"),
			comment: "Try to add file",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Create", mock.Anything, "fail/file.txt", "main", []byte("bad content"), "Try to add file").
					Return(errors.New("nanoGit error"))
			},
			expectedError: errors.New("nanoGit error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := git.NewMockGitRepository(t)
			if tt.mockSetup != nil {
				tt.mockSetup(t, gitRepo)
			}

			repo := &githubRepository{
				config:  tt.config,
				gitRepo: gitRepo,
				owner:   "grafana",
				repo:    "grafana",
			}

			err := repo.Create(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expectedError.Error())
			} else {
				require.NoError(t, err)
			}

			gitRepo.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_Update(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		data          []byte
		comment       string
		mockSetup     func(t *testing.T, gitRepo *git.MockGitRepository)
		expectedError error
	}{
		{
			name: "successful update",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "",
					},
				},
			},
			path:    "file.txt",
			ref:     "main",
			data:    []byte("updated content"),
			comment: "Update file",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Update", mock.Anything, "file.txt", "main", []byte("updated content"), "Update file").
					Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "returns error from nanoGit",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "",
					},
				},
			},
			path:    "fail/file.txt",
			ref:     "main",
			data:    []byte("bad content"),
			comment: "Try to update file",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Update", mock.Anything, "fail/file.txt", "main", []byte("bad content"), "Try to update file").
					Return(errors.New("nanoGit update error"))
			},
			expectedError: errors.New("nanoGit update error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := git.NewMockGitRepository(t)
			if tt.mockSetup != nil {
				tt.mockSetup(t, gitRepo)
			}

			repo := &githubRepository{
				config:  tt.config,
				gitRepo: gitRepo,
				owner:   "grafana",
				repo:    "grafana",
			}

			err := repo.Update(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expectedError.Error())
			} else {
				require.NoError(t, err)
			}

			gitRepo.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_Write(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		data          []byte
		comment       string
		mockSetup     func(t *testing.T, gitRepo *git.MockGitRepository)
		expectedError error
	}{
		{
			name: "delegates write to nanogit",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "main",
			data:    []byte("dashboard content"),
			comment: "Add dashboard",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Write", mock.Anything, "dashboard.json", "main", []byte("dashboard content"), "Add dashboard").
					Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "returns error from nanogit",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "fail/dashboard.json",
			ref:     "main",
			data:    []byte("bad content"),
			comment: "Try to write file",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Write", mock.Anything, "fail/dashboard.json", "main", []byte("bad content"), "Try to write file").
					Return(errors.New("nanogit write error"))
			},
			expectedError: errors.New("nanogit write error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := git.NewMockGitRepository(t)
			if tt.mockSetup != nil {
				tt.mockSetup(t, gitRepo)
			}

			repo := &githubRepository{
				config:  tt.config,
				gitRepo: gitRepo,
				owner:   "grafana",
				repo:    "grafana",
			}

			err := repo.Write(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expectedError.Error())
			} else {
				require.NoError(t, err)
			}

			gitRepo.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_Delete(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		mockSetup     func(t *testing.T, gitRepo *git.MockGitRepository)
		expectedError error
	}{
		{
			name: "delegates delete to nanogit repo",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "base/path",
					},
				},
			},
			path: "test/file.txt",
			ref:  "feature-branch",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Delete", mock.Anything, "test/file.txt", "feature-branch").
					Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "returns error from nanogit",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "",
					},
				},
			},
			path: "fail/file.txt",
			ref:  "main",
			mockSetup: func(t *testing.T, gitRepo *git.MockGitRepository) {
				gitRepo.On("Delete", mock.Anything, "fail/file.txt", "main").
					Return(errors.New("nanogit delete error"))
			},
			expectedError: errors.New("nanogit delete error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := git.NewMockGitRepository(t)
			if tt.mockSetup != nil {
				tt.mockSetup(t, gitRepo)
			}

			repo := &githubRepository{
				config:  tt.config,
				gitRepo: gitRepo,
				owner:   "grafana",
				repo:    "grafana",
			}

			err := repo.Delete(context.Background(), tt.path, tt.ref, "test")

			if tt.expectedError != nil {
				require.Error(t, err)
				require.EqualError(t, err, tt.expectedError.Error())
			} else {
				require.NoError(t, err)
			}

			gitRepo.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_History(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		mockSetup     func(t *testing.T, mockClient *MockClient)
		expected      []provisioning.HistoryItem
		expectedError error
	}{
		{
			name: "successful history retrieval",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(t *testing.T, mockClient *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						Committer: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
					{
						Ref:     "def456",
						Message: "Initial commit",
						Author: &CommitAuthor{
							Name:      "Jane Smith",
							Username:  "janesmith",
							AvatarURL: "https://example.com/avatar2.png",
						},
						Committer: &CommitAuthor{
							Name:      "Bob Johnson",
							Username:  "bjohnson",
							AvatarURL: "https://example.com/avatar3.png",
						},
						CreatedAt: time.Date(2022, 12, 31, 10, 0, 0, 0, time.UTC),
					},
				}

				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "dashboard.json", "main").
					Return(commits, nil)
			},
			expected: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
				{
					Ref:     "def456",
					Message: "Initial commit",
					Authors: []provisioning.Author{
						{
							Name:      "Jane Smith",
							Username:  "janesmith",
							AvatarURL: "https://example.com/avatar2.png",
						},
						{
							Name:      "Bob Johnson",
							Username:  "bjohnson",
							AvatarURL: "https://example.com/avatar3.png",
						},
					},
					CreatedAt: time.Date(2022, 12, 31, 10, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "committer same as author",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(t *testing.T, mockClient *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						Committer: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}

				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(commits, nil)
			},
			expected: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "file not found",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path: "nonexistent.json",
			ref:  "main",
			mockSetup: func(t *testing.T, mockClient *MockClient) {
				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "grafana/nonexistent.json", "main").
					Return(nil, ErrResourceNotFound)
			},
			expectedError: repository.ErrFileNotFound,
		},
		{
			name: "prefixed path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "custom/prefix",
						Branch: "main",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(t *testing.T, mockClient *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}

				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "custom/prefix/dashboard.json", "main").
					Return(commits, nil)
			},
			expected: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
		{
			name: "other error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path: "dashboard.json",
			ref:  "main",
			mockSetup: func(t *testing.T, mockClient *MockClient) {
				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(nil, errors.New("api error"))
			},
			expectedError: errors.New("get commits: api error"),
		},
		{
			name: "use default branch when ref is empty",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path: "dashboard.json",
			ref:  "",
			mockSetup: func(t *testing.T, mockClient *MockClient) {
				commits := []Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
				}

				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(commits, nil)
			},
			expected: []provisioning.HistoryItem{
				{
					Ref:     "abc123",
					Message: "Update dashboard",
					Authors: []provisioning.Author{
						{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
					},
					CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock GitHub client
			mockClient := NewMockClient(t)

			// Set up the mock expectations
			if tt.mockSetup != nil {
				tt.mockSetup(t, mockClient)
			}

			// Create a GitHub repository with the test config and mock client
			repo := &githubRepository{
				config: tt.config,
				gh:     mockClient,
				owner:  "grafana",
				repo:   "grafana",
			}

			// Call the History method
			history, err := repo.History(context.Background(), tt.path, tt.ref)

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.expectedError, &statusErr) {
					var actualStatusErr *apierrors.StatusError
					require.True(t, errors.As(err, &actualStatusErr), "Expected StatusError but got different error type")
					require.Equal(t, statusErr.Status().Message, actualStatusErr.Status().Message)
					require.Equal(t, statusErr.Status().Code, actualStatusErr.Status().Code)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, history)
			}

			// Verify all mock expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_LatestRef(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(mock *MockClient)
		expectedRef   string
		expectedError error
	}{
		{
			name: "successful retrieval of latest ref",
			setupMock: func(m *MockClient) {
				m.On("GetBranch", mock.Anything, "grafana", "grafana", "main").
					Return(Branch{Sha: "abc123"}, nil)
			},
			expectedRef:   "abc123",
			expectedError: nil,
		},
		{
			name: "error getting branch",
			setupMock: func(m *MockClient) {
				m.On("GetBranch", mock.Anything, "grafana", "grafana", "main").
					Return(Branch{}, fmt.Errorf("branch not found"))
			},
			expectedRef:   "",
			expectedError: fmt.Errorf("get branch: branch not found"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := NewMockClient(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubRepository{
				gh: mockGH,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							Branch: "main",
						},
					},
				},
				owner: "grafana",
				repo:  "grafana",
			}

			// Call the LatestRef method
			ref, err := repo.LatestRef(context.Background())

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedRef, ref)
			}

			// Verify all mock expectations were met
			mockGH.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_CompareFiles(t *testing.T) {
	tests := []struct {
		name            string
		setupMock       func(m *MockClient)
		base            string
		ref             string
		expectedFiles   []repository.VersionedFileChange
		expectedError   error
		shouldGetLatest bool
	}{
		{
			name: "successfully compare files",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/test.json")
				commitFile1.On("GetStatus").Return("added")

				commitFile2 := NewMockCommitFile(t)
				commitFile2.On("GetFilename").Return("dashboards/modified.json")
				commitFile2.On("GetStatus").Return("modified")

				commitFile3 := NewMockCommitFile(t)
				commitFile3.On("GetFilename").Return("dashboards/renamed.json")
				commitFile3.On("GetStatus").Return("renamed")
				commitFile3.On("GetPreviousFilename").Return("dashboards/old.json")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
						commitFile2,
						commitFile3,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:   "test.json",
					Ref:    "def456",
					Action: repository.FileActionCreated,
				},
				{
					Path:   "modified.json",
					Ref:    "def456",
					Action: repository.FileActionUpdated,
				},
				{
					Path:         "renamed.json",
					Ref:          "def456",
					Action:       repository.FileActionRenamed,
					PreviousPath: "old.json",
				},
			},
			expectedError: nil,
		},
		{
			name: "error comparing commits",
			setupMock: func(m *MockClient) {
				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return(nil, fmt.Errorf("failed to compare commits"))
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: nil,
			expectedError: fmt.Errorf("compare commits: failed to compare commits"),
		},
		{
			name: "file outside configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("../outside/path.json")
				commitFile1.On("GetStatus").Return("added")

				commitFile2 := NewMockCommitFile(t)
				commitFile2.On("GetFilename").Return("dashboards/valid.json")
				commitFile2.On("GetStatus").Return("added")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
						commitFile2,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:   "valid.json",
					Ref:    "def456",
					Action: repository.FileActionCreated,
				},
			},
			expectedError: nil,
		},
		{
			name: "modified file outside configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("../outside/modified.json")
				commitFile1.On("GetStatus").Return("modified")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: []repository.VersionedFileChange{},
			expectedError: nil,
		},
		{
			name: "copied file status",
			setupMock: func(m *MockClient) {
				// File inside configured path
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/copied.json")
				commitFile1.On("GetStatus").Return("copied")

				// File outside configured path
				commitFile2 := NewMockCommitFile(t)
				commitFile2.On("GetFilename").Return("../outside/copied.json")
				commitFile2.On("GetStatus").Return("copied")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
						commitFile2,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:   "copied.json",
					Ref:    "def456",
					Action: repository.FileActionCreated,
				},
			},
			expectedError: nil,
		},
		{
			name: "removed file status - inside path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/removed.json")
				commitFile1.On("GetStatus").Return("removed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:         "removed.json",
					PreviousPath: "removed.json",
					Ref:          "def456",
					PreviousRef:  "abc123",
					Action:       repository.FileActionDeleted,
				},
			},
			expectedError: nil,
		},
		{
			name: "renamed file status - both paths outside configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("../outside/renamed.json")
				commitFile1.On("GetPreviousFilename").Return("../outside/original.json")
				commitFile1.On("GetStatus").Return("renamed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: []repository.VersionedFileChange{},
			expectedError: nil,
		},
		{
			name: "renamed file status - both paths inside configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/renamed.json")
				commitFile1.On("GetPreviousFilename").Return("dashboards/original.json")
				commitFile1.On("GetStatus").Return("renamed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:         "renamed.json",
					PreviousPath: "original.json",
					Ref:          "def456",
					PreviousRef:  "abc123",
					Action:       repository.FileActionRenamed,
				},
			},
			expectedError: nil,
		},
		{
			name: "renamed file status - moving out of configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("../outside/renamed.json")
				commitFile1.On("GetPreviousFilename").Return("dashboards/original.json")
				commitFile1.On("GetStatus").Return("renamed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:   "original.json",
					Ref:    "abc123",
					Action: repository.FileActionDeleted,
				},
			},
			expectedError: nil,
		},
		{
			name: "renamed file status - moving into configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/renamed.json")
				commitFile1.On("GetPreviousFilename").Return("../outside/original.json")
				commitFile1.On("GetStatus").Return("renamed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base: "abc123",
			ref:  "def456",
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:   "renamed.json",
					Ref:    "def456",
					Action: repository.FileActionCreated,
				},
			},
			expectedError: nil,
		},
		{
			name: "removed file status - outside path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("../outside/removed.json")
				commitFile1.On("GetStatus").Return("removed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: []repository.VersionedFileChange{},
			expectedError: nil,
		},
		{
			name: "changed file outside configured path",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("../outside/changed.json")
				commitFile1.On("GetStatus").Return("changed")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: []repository.VersionedFileChange{},
			expectedError: nil,
		},
		{
			name: "get latest ref when ref is empty",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/test.json")
				commitFile1.On("GetStatus").Return("added")

				m.On("GetBranch", mock.Anything, "grafana", "grafana", "main").
					Return(Branch{Sha: "latest123"}, nil)
				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "latest123").
					Return([]CommitFile{commitFile1}, nil)
			},
			base:            "abc123",
			ref:             "",
			shouldGetLatest: true,
			expectedFiles: []repository.VersionedFileChange{
				{
					Path:   "test.json",
					Ref:    "latest123",
					Action: repository.FileActionCreated,
				},
			},
			expectedError: nil,
		},
		{
			name: "unchanged file status",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetStatus").Return("unchanged")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: []repository.VersionedFileChange{},
			expectedError: nil,
		},
		{
			name: "unknown file status",
			setupMock: func(m *MockClient) {
				commitFile1 := NewMockCommitFile(t)
				commitFile1.On("GetFilename").Return("dashboards/unknown.json")
				commitFile1.On("GetStatus").Return("unknown_status")

				m.On("CompareCommits", mock.Anything, "grafana", "grafana", "abc123", "def456").
					Return([]CommitFile{
						commitFile1,
					}, nil)
			},
			base:          "abc123",
			ref:           "def456",
			expectedFiles: []repository.VersionedFileChange{},
			expectedError: nil,
		},
		{
			name: "error getting latest ref",
			setupMock: func(m *MockClient) {
				m.On("GetBranch", mock.Anything, "grafana", "grafana", "main").
					Return(Branch{}, fmt.Errorf("branch not found"))
			},
			base:            "abc123",
			ref:             "",
			shouldGetLatest: true,
			expectedFiles:   nil,
			expectedError:   fmt.Errorf("get latest ref: get branch: branch not found"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := NewMockClient(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubRepository{
				gh: mockGH,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							Branch: "main",
							Path:   "dashboards",
						},
					},
				},
				owner: "grafana",
				repo:  "grafana",
			}

			// Call the CompareFiles method
			files, err := repo.CompareFiles(context.Background(), tt.base, tt.ref)

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, len(tt.expectedFiles), len(files))

				for i, expectedFile := range tt.expectedFiles {
					require.Equal(t, expectedFile.Path, files[i].Path)
					require.Equal(t, expectedFile.Ref, files[i].Ref)
					require.Equal(t, expectedFile.Action, files[i].Action)
					require.Equal(t, expectedFile.PreviousPath, files[i].PreviousPath)
				}
			}

			// Verify all mock expectations were met
			mockGH.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_ResourceURLs(t *testing.T) {
	tests := []struct {
		name          string
		file          *repository.FileInfo
		config        *provisioning.Repository
		expectedURLs  *provisioning.ResourceURLs
		expectedError error
	}{
		{
			name: "file with ref",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "feature-branch",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs: &provisioning.ResourceURLs{
				RepositoryURL:     "https://github.com/grafana/grafana",
				SourceURL:         "https://github.com/grafana/grafana/blob/feature-branch/dashboards/test.json",
				CompareURL:        "https://github.com/grafana/grafana/compare/main...feature-branch",
				NewPullRequestURL: "https://github.com/grafana/grafana/compare/main...feature-branch?quick_pull=1&labels=grafana",
			},
			expectedError: nil,
		},
		{
			name: "file without ref uses default branch",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs: &provisioning.ResourceURLs{
				RepositoryURL: "https://github.com/grafana/grafana",
				SourceURL:     "https://github.com/grafana/grafana/blob/main/dashboards/test.json",
			},
			expectedError: nil,
		},
		{
			name: "file with ref same as branch",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "main",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs: &provisioning.ResourceURLs{
				RepositoryURL: "https://github.com/grafana/grafana",
				SourceURL:     "https://github.com/grafana/grafana/blob/main/dashboards/test.json",
			},
			expectedError: nil,
		},
		{
			name: "empty path returns nil",
			file: &repository.FileInfo{
				Path: "",
				Ref:  "feature-branch",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/grafana/grafana",
						Branch: "main",
					},
				},
			},
			expectedURLs:  nil,
			expectedError: nil,
		},
		{
			name: "nil github config returns nil",
			file: &repository.FileInfo{
				Path: "dashboards/test.json",
				Ref:  "feature-branch",
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: nil,
				},
			},
			expectedURLs:  nil,
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create repository
			repo := &githubRepository{
				config: tt.config,
				owner:  "grafana",
				repo:   "grafana",
			}

			// Call the ResourceURLs method
			urls, err := repo.ResourceURLs(context.Background(), tt.file)

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedURLs, urls)
			}
		})
	}
}

// TODO: simply redirect
func TestGitHubRepository_Stage(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *repository.MockStageableRepository)
		config        *provisioning.Repository
		expectedError error
	}{
		{
			name: "successfully clone repository",
			setupMock: func(m *repository.MockStageableRepository) {
				m.On("Execute", mock.Anything, repository.StageOptions{
					PushOnWrites: true,
					Timeout:      10 * time.Second,
				}).Return(nil, nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			expectedError: nil,
		},
		{
			name: "error cloning repository",
			setupMock: func(m *repository.MockStageableRepository) {
				m.On("Execute", mock.Anything, repository.StageOptions{
					PushOnWrites: true,
					Timeout:      10 * time.Second,
				}).Return(nil, fmt.Errorf("failed to clone repository"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			expectedError: fmt.Errorf("failed to clone repository"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockCloneFn := repository.NewMockStageableRepository(t)

			tt.setupMock(mockCloneFn)

			// Create repository with mock
			repo := &githubRepository{
				config: tt.config,
				owner:  "grafana",
				repo:   "grafana",
			}

			// Call the Clone method with a placeholder directory path
			_, err := repo.Stage(context.Background(), repository.StageOptions{
				PushOnWrites: true,
				Timeout:      10 * time.Second,
			})

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify all mock expectations were met
			mockCloneFn.AssertExpectations(t)
		})
	}
}
