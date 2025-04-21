package repository

import (
	context "context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	field "k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
)

func TestIsValidGitBranchName(t *testing.T) {
	tests := []struct {
		name     string
		branch   string
		expected bool
	}{
		{"Valid branch name", "feature/add-tests", true},
		{"Valid branch name with numbers", "feature/123-add-tests", true},
		{"Valid branch name with dots", "feature.add.tests", true},
		{"Valid branch name with hyphens", "feature-add-tests", true},
		{"Valid branch name with underscores", "feature_add_tests", true},
		{"Valid branch name with mixed characters", "feature/add_tests-123", true},
		{"Starts with /", "/feature", false},
		{"Ends with /", "feature/", false},
		{"Ends with .", "feature.", false},
		{"Ends with space", "feature ", false},
		{"Contains consecutive slashes", "feature//branch", false},
		{"Contains consecutive dots", "feature..branch", false},
		{"Contains @{", "feature@{branch", false},
		{"Contains invalid character ~", "feature~branch", false},
		{"Contains invalid character ^", "feature^branch", false},
		{"Contains invalid character :", "feature:branch", false},
		{"Contains invalid character ?", "feature?branch", false},
		{"Contains invalid character *", "feature*branch", false},
		{"Contains invalid character [", "feature[branch", false},
		{"Contains invalid character ]", "feature]branch", false},
		{"Contains invalid character \\", "feature\\branch", false},
		{"Empty branch name", "", false},
		{"Only whitespace", " ", false},
		{"Single valid character", "a", true},
		{"Ends with .lock", "feature.lock", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, isValidGitBranchName(tt.branch))
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
		mockSetup      func(t *testing.T, client *pgh.MockClient)
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(errors.New("authentication failed"))
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   v1.CauseTypeFieldValueInvalid,
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("IsAuthenticated", mock.Anything).Return(nil)
			},
			expectedResult: &provisioning.TestResults{
				Code:    http.StatusBadRequest,
				Success: false,
				Errors: []provisioning.ErrorDetails{{
					Type:   v1.CauseTypeFieldValueInvalid,
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
			mockClient := pgh.NewMockClient(t)

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
				owner, githubRepo, _ := parseOwnerRepo(tt.config.Spec.GitHub.URL)
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

func TestParseWebhooks(t *testing.T) {
	tests := []struct {
		messageType string
		name        string
		expected    provisioning.WebhookResponse
	}{
		{"ping", "check", provisioning.WebhookResponse{
			Code: http.StatusOK,
		}},
		{"pull_request", "opened", provisioning.WebhookResponse{
			Code: http.StatusAccepted, // 202
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPullRequest,
				PullRequest: &provisioning.PullRequestJobOptions{
					Ref:  "dashboard/1733653266690",
					Hash: "ab5446a53df9e5f8bdeed52250f51fad08e822bc",
					PR:   12,
					URL:  "https://github.com/grafana/git-ui-sync-demo/pull/12",
				},
			},
		}},
		{"push", "different_branch", provisioning.WebhookResponse{
			Code: http.StatusOK, // we don't care about a branch that isn't the one we configured
		}},
		{"push", "nothing_relevant", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{ // we want to always push a sync job
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: true,
				},
			},
		}},
		{"push", "nested", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: true,
				},
			},
		}},
		{"issue_comment", "created", provisioning.WebhookResponse{
			Code: http.StatusNotImplemented,
		}},
	}

	gh := &githubRepository{
		config: &provisioning.Repository{
			ObjectMeta: v1.ObjectMeta{
				Name: "unit-test-repo",
			},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{
					Enabled: true, // required to accept sync job
				},
				GitHub: &provisioning.GitHubRepositoryConfig{
					URL:    "https://github.com/grafana/git-ui-sync-demo",
					Branch: "main",

					GenerateDashboardPreviews: true,
				},
			},
		},
	}
	var err error
	gh.owner, gh.repo, err = parseOwnerRepo(gh.config.Spec.GitHub.URL)
	require.NoError(t, err)

	// Support parsing from a ".git" extension
	owner, repo, err := parseOwnerRepo(gh.config.Spec.GitHub.URL + ".git")
	require.NoError(t, err)
	require.Equal(t, gh.owner, owner)
	require.Equal(t, gh.repo, repo)

	for _, tt := range tests {
		name := fmt.Sprintf("webhook-%s-%s.json", tt.messageType, tt.name)
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(path.Join("github", "testdata", name))
			require.NoError(t, err)

			rsp, err := gh.parseWebhook(tt.messageType, payload)
			require.NoError(t, err)

			require.Equal(t, tt.expected.Code, rsp.Code)
			require.Equal(t, tt.expected.Job, rsp.Job)
		})
	}
}

func TestReadTree(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		tree     []pgh.RepositoryContent
		expected []FileTreeEntry
	}{
		{name: "empty tree", tree: []pgh.RepositoryContent{}, expected: []FileTreeEntry{}},
		{name: "single file", tree: func() []pgh.RepositoryContent {
			content := pgh.NewMockRepositoryContent(t)
			content.EXPECT().GetPath().Return("file.txt")
			content.EXPECT().GetSize().Return(int64(100))
			content.EXPECT().GetSHA().Return("abc123")
			content.EXPECT().IsDirectory().Return(false)
			return []pgh.RepositoryContent{content}
		}(), expected: []FileTreeEntry{
			{Path: "file.txt", Size: 100, Hash: "abc123", Blob: true},
		}},
		{name: "single directory", tree: func() []pgh.RepositoryContent {
			content := pgh.NewMockRepositoryContent(t)
			content.EXPECT().GetPath().Return("dir")
			content.EXPECT().IsDirectory().Return(true)
			content.EXPECT().GetSize().Return(int64(0))
			content.EXPECT().GetSHA().Return("")

			return []pgh.RepositoryContent{content}
		}(), expected: []FileTreeEntry{
			{Path: "dir/", Blob: false},
		}},
		{name: "mixed content", tree: func() []pgh.RepositoryContent {
			file1 := pgh.NewMockRepositoryContent(t)
			file1.EXPECT().GetPath().Return("file1.txt")
			file1.EXPECT().GetSize().Return(int64(100))
			file1.EXPECT().GetSHA().Return("abc123")
			file1.EXPECT().IsDirectory().Return(false)

			dir := pgh.NewMockRepositoryContent(t)
			dir.EXPECT().GetPath().Return("dir")
			dir.EXPECT().IsDirectory().Return(true)
			dir.EXPECT().GetSize().Return(int64(0))
			dir.EXPECT().GetSHA().Return("")

			file2 := pgh.NewMockRepositoryContent(t)
			file2.EXPECT().GetPath().Return("file2.txt")
			file2.EXPECT().GetSize().Return(int64(200))
			file2.EXPECT().GetSHA().Return("def456")
			file2.EXPECT().IsDirectory().Return(false)

			return []pgh.RepositoryContent{file1, dir, file2}
		}(), expected: []FileTreeEntry{
			{Path: "file1.txt", Size: 100, Hash: "abc123", Blob: true},
			{Path: "dir/", Blob: false},
			{Path: "file2.txt", Size: 200, Hash: "def456", Blob: true},
		}},
		{name: "with path prefix", path: "prefix", tree: func() []pgh.RepositoryContent {
			file := pgh.NewMockRepositoryContent(t)
			file.EXPECT().GetPath().Return("file.txt")
			file.EXPECT().GetSize().Return(int64(100))
			file.EXPECT().GetSHA().Return("abc123")
			file.EXPECT().IsDirectory().Return(false)

			dir := pgh.NewMockRepositoryContent(t)
			dir.EXPECT().GetPath().Return("dir")
			dir.EXPECT().GetSize().Return(int64(0))
			dir.EXPECT().GetSHA().Return("")
			dir.EXPECT().IsDirectory().Return(true)

			return []pgh.RepositoryContent{file, dir}
		}(), expected: []FileTreeEntry{
			{Path: "file.txt", Size: 100, Hash: "abc123", Blob: true},
			{Path: "dir/", Blob: false},
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ghMock := pgh.NewMockClient(t)
			gh := &githubRepository{
				owner: "owner",
				repo:  "repo",
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							Path: tt.path,
						},
					},
				},
				gh: ghMock,
			}

			ghMock.On("GetTree", mock.Anything, "owner", "repo", tt.path, "some-ref", true).Return(tt.tree, false, nil)
			tree, err := gh.ReadTree(context.Background(), "some-ref")
			require.NoError(t, err)
			require.Equal(t, tt.expected, tree)
		})
	}
}

func TestGitHubRepository_Read(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		filePath       string
		ref            string
		mockSetup      func(t *testing.T, client *pgh.MockClient)
		expectedResult *FileInfo
		expectedError  string
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("file content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "main").
					Return(fileContent, nil, nil)
			},
			expectedResult: &FileInfo{
				Path: "dashboard.json",
				Ref:  "main",
				Data: []byte("file content"),
				Hash: "abc123",
			},
			expectedError: "",
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				dirContent := []pgh.RepositoryContent{
					// Directory contents not used in this test
				}
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboards", "main").
					Return(nil, dirContent, nil)
			},
			expectedResult: &FileInfo{
				Path: "dashboards",
				Ref:  "main",
			},
			expectedError: "",
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/nonexistent.json", "main").
					Return(nil, nil, pgh.ErrResourceNotFound)
			},
			expectedResult: nil,
			expectedError:  "file not found; path=configs/nonexistent.json ref=main",
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("", errors.New("failed to decode content"))
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "main").
					Return(fileContent, nil, nil)
			},
			expectedResult: nil,
			expectedError:  "get content: failed to decode content",
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "main").
					Return(nil, nil, errors.New("API rate limit exceeded"))
			},
			expectedResult: nil,
			expectedError:  "get contents: API rate limit exceeded",
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("file content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/dashboard.json", "develop").
					Return(fileContent, nil, nil)
			},
			expectedResult: &FileInfo{
				Path: "dashboard.json",
				Ref:  "develop",
				Data: []byte("file content"),
				Hash: "abc123",
			},
			expectedError: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock GitHub client
			mockClient := pgh.NewMockClient(t)

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
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}

			// Check the result
			if tt.expectedResult != nil {
				assert.Equal(t, tt.expectedResult.Path, result.Path)
				assert.Equal(t, tt.expectedResult.Ref, result.Ref)
				assert.Equal(t, tt.expectedResult.Data, result.Data)
			} else {
				assert.Nil(t, result)
			}
		})
	}
}
