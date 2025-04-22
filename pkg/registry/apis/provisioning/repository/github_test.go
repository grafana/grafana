package repository

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	field "k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
			ObjectMeta: metav1.ObjectMeta{
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
		name          string
		path          string
		ref           string
		expectedRef   string
		tree          []pgh.RepositoryContent
		expected      []FileTreeEntry
		getTreeErr    error
		truncated     bool
		expectedError error
	}{
		{name: "empty ref", ref: "", expectedRef: "develop", tree: []pgh.RepositoryContent{}, expected: []FileTreeEntry{}},
		{name: "unknown error to get tree", ref: "develop", expectedRef: "develop", tree: []pgh.RepositoryContent{}, getTreeErr: errors.New("unknown error"), expectedError: errors.New("get tree: unknown error")},
		{name: "tree not found error", ref: "develop", expectedRef: "develop", tree: []pgh.RepositoryContent{}, getTreeErr: pgh.ErrResourceNotFound, expectedError: &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "tree not found; ref=develop",
				Code:    http.StatusNotFound,
			},
		}},
		{name: "tree truncated", ref: "develop", expectedRef: "develop", tree: []pgh.RepositoryContent{}, truncated: true, expectedError: errors.New("tree truncated")},
		{name: "empty tree", ref: "develop", expectedRef: "develop", tree: []pgh.RepositoryContent{}, expected: []FileTreeEntry{}},
		{name: "single file", ref: "develop", expectedRef: "develop", tree: func() []pgh.RepositoryContent {
			content := pgh.NewMockRepositoryContent(t)
			content.EXPECT().GetPath().Return("file.txt")
			content.EXPECT().GetSize().Return(int64(100))
			content.EXPECT().GetSHA().Return("abc123")
			content.EXPECT().IsDirectory().Return(false)
			return []pgh.RepositoryContent{content}
		}(), expected: []FileTreeEntry{
			{Path: "file.txt", Size: 100, Hash: "abc123", Blob: true},
		}},
		{name: "single directory", ref: "develop", expectedRef: "develop", tree: func() []pgh.RepositoryContent {
			content := pgh.NewMockRepositoryContent(t)
			content.EXPECT().GetPath().Return("dir")
			content.EXPECT().IsDirectory().Return(true)
			content.EXPECT().GetSize().Return(int64(0))
			content.EXPECT().GetSHA().Return("")

			return []pgh.RepositoryContent{content}
		}(), expected: []FileTreeEntry{
			{Path: "dir/", Blob: false},
		}},
		{name: "mixed content", ref: "develop", expectedRef: "develop", tree: func() []pgh.RepositoryContent {
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
		{name: "with path prefix", ref: "develop", expectedRef: "develop", tree: func() []pgh.RepositoryContent {
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
		mockSetup      func(t *testing.T, client *pgh.MockClient)
		expectedResult *FileInfo
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("GetContents", mock.Anything, "grafana", "grafana", "configs/nonexistent.json", "main").
					Return(nil, nil, pgh.ErrResourceNotFound)
			},
			expectedResult: nil,
			expectedError:  ErrFileNotFound,
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
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
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
		mockSetup     func(t *testing.T, mockClient *pgh.MockClient)
		expectedError error
	}{
		{
			name: "successful file creation",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature-branch",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "feature-branch").Return(true, nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "feature-branch", "Add new dashboard", []byte("dashboard content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "create with default branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main", "Add new dashboard", []byte("dashboard content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "branch already exists error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature-branch",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "feature-branch").Return(false, nil)
				mockClient.EXPECT().CreateBranch(mock.Anything, "grafana", "grafana", "main", "feature-branch").Return(pgh.ErrResourceAlreadyExists)
			},
			expectedError: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusConflict,
					Message: "branch already exists",
				},
			},
		},
		{
			name: "branch does not exist error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature-branch",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "feature-branch").Return(false, nil)
				mockClient.EXPECT().CreateBranch(mock.Anything, "grafana", "grafana", "main", "feature-branch").Return(fmt.Errorf("failed to create branch"))
			},
			expectedError: fmt.Errorf("create branch: %w", fmt.Errorf("failed to create branch")),
		},
		{
			name: "branch does not exist but it's created",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature-branch",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "feature-branch").Return(false, nil)
				mockClient.EXPECT().CreateBranch(mock.Anything, "grafana", "grafana", "main", "feature-branch").Return(nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "feature-branch", "Add new dashboard", []byte("dashboard content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "invalid branch name",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature//branch",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				// No mock expectations needed as validation should fail before any GitHub API calls
			},
			expectedError: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusBadRequest,
					Message: "invalid branch name",
				},
			},
		},
		{
			name: "branch exists check fails",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature-branch",
			data:    []byte("dashboard content"),
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "feature-branch").Return(false, fmt.Errorf("failed to check branch"))
			},
			expectedError: fmt.Errorf("check branch exists: %w", fmt.Errorf("failed to check branch")),
		},
		{
			name: "file already exists",
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
			comment: "Add new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main", "Add new dashboard", []byte("dashboard content")).Return(pgh.ErrResourceAlreadyExists)
			},
			expectedError: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: "file already exists",
					Code:    http.StatusConflict,
				},
			},
		},
		{
			name: "create directory with .keep file",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboards/",
			ref:     "main",
			data:    nil,
			comment: "Add dashboards directory",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/.keep", "main", "Add dashboards directory", []byte{}).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "error when providing data for directory",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboards/",
			ref:     "main",
			data:    []byte("some data"),
			comment: "Add dashboards directory",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
			},
			expectedError: apierrors.NewBadRequest("data cannot be provided for a directory"),
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

			// Call the Create method
			err := repo.Create(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

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

			// Verify all mock expectations were met
			mockClient.AssertExpectations(t)
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
		mockSetup     func(t *testing.T, client *pgh.MockClient)
		expectedError error
	}{
		{
			name: "Successfully update file",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(true, nil)
				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch").
					Return(fileContent, nil, nil)
				client.On("UpdateFile", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch",
					"Update test file", "abc123", []byte("updated content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "Use default branch when ref is empty",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "base/path",
					},
				},
			},
			path:    "test/file.txt",
			ref:     "",
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "main").
					Return(fileContent, nil, nil)
				client.On("UpdateFile", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "main",
					"Update test file", "abc123", []byte("updated content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "Branch does not exist",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(false, nil)
				client.On("CreateBranch", mock.Anything, "grafana", "grafana", "main", "feature-branch").Return(errors.New("failed to create branch"))
			},
			expectedError: errors.New("create branch: failed to create branch"),
		},
		{
			name: "Invalid branch name",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "base/path",
					},
				},
			},
			path:    "test/file.txt",
			ref:     "invalid//branch",
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				// No mock calls expected
			},
			expectedError: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusBadRequest,
					Message: "invalid branch name",
				},
			},
		},
		{
			name: "Branch exists check fails",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(false, errors.New("failed to check branch"))
			},
			expectedError: errors.New("check branch exists: failed to check branch"),
		},
		{
			name: "Branch does not exist but it's created successfully",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(false, nil)
				client.On("CreateBranch", mock.Anything, "grafana", "grafana", "main", "feature-branch").Return(nil)
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)
				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch").
					Return(fileContent, nil, nil)
				client.On("UpdateFile", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch",
					"Update test file", "abc123", []byte("updated content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "Branch already exists error",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(false, nil)
				client.On("CreateBranch", mock.Anything, "grafana", "grafana", "main", "feature-branch").Return(pgh.ErrResourceAlreadyExists)
			},
			expectedError: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusConflict,
					Message: "branch already exists",
				},
			},
		},
		{
			name: "File not found",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(true, nil)
				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch").
					Return(nil, nil, pgh.ErrResourceNotFound)
			},
			expectedError: &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: "file not found",
					Code:    http.StatusNotFound,
				},
			},
		},
		{
			name: "Error getting file contents",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(true, nil)
				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch").
					Return(nil, nil, errors.New("API error"))
			},
			expectedError: errors.New("get content before file update: API error"),
		},
		{
			name: "Cannot update directory",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
						Path:   "base/path",
					},
				},
			},
			path:    "test/directory",
			ref:     "feature-branch",
			data:    []byte("updated content"),
			comment: "Update test directory",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(true, nil)

				// Create a directory file
				dirFile := pgh.NewMockRepositoryContent(t)
				dirFile.EXPECT().IsDirectory().Return(true)

				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/directory", "feature-branch").
					Return(dirFile, nil, nil)
			},
			expectedError: apierrors.NewBadRequest("cannot update a directory"),
		},
		{
			name: "Error updating file",
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
			data:    []byte("updated content"),
			comment: "Update test file",
			mockSetup: func(t *testing.T, client *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)
				client.On("BranchExists", mock.Anything, "grafana", "grafana", "feature-branch").Return(true, nil)
				client.On("GetContents", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch").
					Return(fileContent, nil, nil)
				client.On("UpdateFile", mock.Anything, "grafana", "grafana", "base/path/test/file.txt", "feature-branch",
					"Update test file", "abc123", []byte("updated content")).Return(errors.New("update failed"))
			},
			expectedError: errors.New("update file: update failed"),
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

			// Call the Update method
			err := repo.Update(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

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

			// Verify all mock expectations were met
			mockClient.AssertExpectations(t)
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
		message       string
		mockSetup     func(t *testing.T, mockClient *pgh.MockClient)
		expectedError error
	}{
		{
			name: "write to existing file (update)",
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
			data:    []byte("updated content"),
			message: "Update dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("existing content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)

				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(fileContent, nil, nil)
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().UpdateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main",
					"Update dashboard", "abc123", []byte("updated content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "write to non-existing file (create)",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "new-dashboard.json",
			ref:     "main",
			data:    []byte("new content"),
			message: "Create new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/new-dashboard.json", "main").
					Return(nil, nil, pgh.ErrResourceNotFound)
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/new-dashboard.json", "main",
					"Create new dashboard", []byte("new content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "write with default branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "",
			data:    []byte("content"),
			message: "Update dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("existing content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)

				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(fileContent, nil, nil)
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().UpdateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main",
					"Update dashboard", "abc123", []byte("content")).Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "error checking if file exists",
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
			data:    []byte("content"),
			message: "Update dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(nil, nil, errors.New("connection error"))
			},
			expectedError: errors.New("check if file exists before writing: get contents: connection error"),
		},
		{
			name: "error during update",
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
			data:    []byte("updated content"),
			message: "Update dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().GetFileContent().Return("existing content", nil)
				fileContent.EXPECT().GetSHA().Return("abc123")
				fileContent.EXPECT().IsDirectory().Return(false)

				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(fileContent, nil, nil)
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().UpdateFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main",
					"Update dashboard", "abc123", []byte("updated content")).Return(errors.New("update failed"))
			},
			expectedError: errors.New("update file: update failed"),
		},
		{
			name: "error during create",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "new-dashboard.json",
			ref:     "main",
			data:    []byte("new content"),
			message: "Create new dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/new-dashboard.json", "main").
					Return(nil, nil, pgh.ErrResourceNotFound)
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().CreateFile(mock.Anything, "grafana", "grafana", "grafana/new-dashboard.json", "main",
					"Create new dashboard", []byte("new content")).Return(errors.New("create failed"))
			},
			expectedError: errors.New("create failed"),
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

			// Call the Write method
			err := repo.Write(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify all mock expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_Delete(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		comment       string
		mockSetup     func(t *testing.T, mockClient *pgh.MockClient)
		expectedError error
	}{
		{
			name: "delete existing file",
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
			comment: "Delete dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().IsDirectory().Return(false)
				fileContent.EXPECT().GetSHA().Return("abc123")

				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(fileContent, nil, nil)
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main",
					"Delete dashboard", "abc123").Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "delete with default branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "",
			comment: "Delete dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().IsDirectory().Return(false)
				fileContent.EXPECT().GetSHA().Return("abc123")

				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(fileContent, nil, nil)
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main",
					"Delete dashboard", "abc123").Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "delete directory recursively",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboards",
			ref:     "main",
			comment: "Delete dashboards directory",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				dirContent := pgh.NewMockRepositoryContent(t)
				dirContent.EXPECT().IsDirectory().Return(true)

				// Directory contents
				file1Content := pgh.NewMockRepositoryContent(t)
				file1Content.EXPECT().GetPath().Return("grafana/dashboards/dashboard1.json")
				file1Content.EXPECT().IsDirectory().Return(false)
				file1Content.EXPECT().GetSHA().Return("file1-sha")

				file2Content := pgh.NewMockRepositoryContent(t)
				file2Content.EXPECT().GetPath().Return("grafana/dashboards/dashboard2.json")
				file2Content.EXPECT().IsDirectory().Return(false)
				file2Content.EXPECT().GetSHA().Return("file2-sha")

				subDirContent := pgh.NewMockRepositoryContent(t)
				subDirContent.EXPECT().GetPath().Return("grafana/dashboards/subfolder")
				subDirContent.EXPECT().IsDirectory().Return(true)

				// Subfolder contents
				subFile1Content := pgh.NewMockRepositoryContent(t)
				subFile1Content.EXPECT().GetPath().Return("grafana/dashboards/subfolder/subdashboard.json")
				subFile1Content.EXPECT().IsDirectory().Return(false)
				subFile1Content.EXPECT().GetSHA().Return("subfile-sha")

				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)

				// Get main directory
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboards", "main").
					Return(dirContent, []pgh.RepositoryContent{file1Content, file2Content, subDirContent}, nil)

				// Get subfolder contents
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboards/subfolder", "main").
					Return(subDirContent, []pgh.RepositoryContent{subFile1Content}, nil)

				// Delete files in reverse order (depth-first)
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/subfolder/subdashboard.json", "main",
					"Delete dashboards directory", "subfile-sha").Return(nil)
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/dashboard2.json", "main",
					"Delete dashboards directory", "file2-sha").Return(nil)
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/dashboard1.json", "main",
					"Delete dashboards directory", "file1-sha").Return(nil)
			},
			expectedError: nil,
		},
		{
			name: "delete directory recursively fails in the middle",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboards",
			ref:     "main",
			comment: "Delete dashboards directory",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				dirContent := pgh.NewMockRepositoryContent(t)
				dirContent.EXPECT().IsDirectory().Return(true)

				// Directory contents
				file1Content := pgh.NewMockRepositoryContent(t)
				file1Content.EXPECT().GetPath().Return("grafana/dashboards/dashboard1.json")
				file1Content.EXPECT().IsDirectory().Return(false)
				file1Content.EXPECT().GetSHA().Return("file1-sha")

				file2Content := pgh.NewMockRepositoryContent(t)
				file2Content.EXPECT().GetPath().Return("grafana/dashboards/dashboard2.json")
				file2Content.EXPECT().IsDirectory().Return(false)
				file2Content.EXPECT().GetSHA().Return("file2-sha")

				subDirContent := pgh.NewMockRepositoryContent(t)
				subDirContent.EXPECT().IsDirectory().Return(true)
				subDirContent.EXPECT().GetPath().Return("grafana/dashboards/subfolder")

				// Subfolder contents
				subFile1Content := pgh.NewMockRepositoryContent(t)
				subFile1Content.EXPECT().GetPath().Return("grafana/dashboards/subfolder/subdashboard.json")
				subFile1Content.EXPECT().IsDirectory().Return(false)
				subFile1Content.EXPECT().GetSHA().Return("subfile-sha")

				subFile2Content := pgh.NewMockRepositoryContent(t)
				subFile2Content.EXPECT().GetPath().Return("grafana/dashboards/subfolder/subdashboard2.json")
				subFile2Content.EXPECT().IsDirectory().Return(false)
				subFile2Content.EXPECT().GetSHA().Return("subfile2-sha")

				subFile3Content := pgh.NewMockRepositoryContent(t)

				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)

				// Get main directory
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboards", "main").
					Return(dirContent, []pgh.RepositoryContent{file1Content, file2Content, subDirContent}, nil)

				// Get subfolder contents
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboards/subfolder", "main").
					Return(subDirContent, []pgh.RepositoryContent{subFile1Content, subFile2Content, subFile3Content}, nil)

				// Delete first file successfully
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/dashboard1.json", "main",
					"Delete dashboards directory", "file1-sha").Return(nil)

				// Second file deletion fails
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/dashboard2.json", "main",
					"Delete dashboards directory", "file2-sha").Return(nil)

				// Delete subfolder files
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/subfolder/subdashboard.json", "main",
					"Delete dashboards directory", "subfile-sha").Return(nil)

				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboards/subfolder/subdashboard2.json", "main",
					"Delete dashboards directory", "subfile2-sha").Return(errors.New("permission denied"))
			},
			expectedError: errors.New("delete directory recursively: delete file: permission denied"),
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
			path:    "nonexistent.json",
			ref:     "main",
			comment: "Delete nonexistent file",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/nonexistent.json", "main").
					Return(nil, nil, pgh.ErrResourceNotFound)
			},
			expectedError: ErrFileNotFound,
		},
		{
			name: "branch does not exist and creation fails",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Path:   "grafana",
						Branch: "main",
					},
				},
			},
			path:    "dashboard.json",
			ref:     "feature",
			comment: "Delete dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "feature").Return(false, nil)
				mockClient.EXPECT().CreateBranch(mock.Anything, "grafana", "grafana", "main", "feature").
					Return(errors.New("failed to create branch"))
			},
			expectedError: errors.New("create branch: failed to create branch"),
		},
		{
			name: "error checking if branch exists",
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
			comment: "Delete dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").
					Return(false, errors.New("API error"))
			},
			expectedError: errors.New("check branch exists: API error"),
		},
		{
			name: "error getting file content",
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
			comment: "Delete dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(nil, nil, errors.New("API rate limit exceeded"))
			},
			expectedError: fmt.Errorf("find file to delete: %w", errors.New("API rate limit exceeded")),
		},
		{
			name: "error deleting file",
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
			comment: "Delete dashboard",
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				fileContent := pgh.NewMockRepositoryContent(t)
				fileContent.EXPECT().IsDirectory().Return(false)
				fileContent.EXPECT().GetSHA().Return("abc123")

				mockClient.EXPECT().BranchExists(mock.Anything, "grafana", "grafana", "main").Return(true, nil)
				mockClient.EXPECT().GetContents(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main").
					Return(fileContent, nil, nil)
				mockClient.EXPECT().DeleteFile(mock.Anything, "grafana", "grafana", "grafana/dashboard.json", "main",
					"Delete dashboard", "abc123").Return(errors.New("delete failed"))
			},
			expectedError: errors.New("delete failed"),
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

			// Call the Delete method
			err := repo.Delete(context.Background(), tt.path, tt.ref, tt.comment)

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify all mock expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_History(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		path          string
		ref           string
		mockSetup     func(t *testing.T, mockClient *pgh.MockClient)
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
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				commits := []pgh.Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &pgh.CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						Committer: &pgh.CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						CreatedAt: time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC),
					},
					{
						Ref:     "def456",
						Message: "Initial commit",
						Author: &pgh.CommitAuthor{
							Name:      "Jane Smith",
							Username:  "janesmith",
							AvatarURL: "https://example.com/avatar2.png",
						},
						Committer: &pgh.CommitAuthor{
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
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				commits := []pgh.Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &pgh.CommitAuthor{
							Name:      "John Doe",
							Username:  "johndoe",
							AvatarURL: "https://example.com/avatar1.png",
						},
						Committer: &pgh.CommitAuthor{
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
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				mockClient.EXPECT().Commits(mock.Anything, "grafana", "grafana", "grafana/nonexistent.json", "main").
					Return(nil, pgh.ErrResourceNotFound)
			},
			expectedError: ErrFileNotFound,
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
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				commits := []pgh.Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &pgh.CommitAuthor{
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
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
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
			mockSetup: func(t *testing.T, mockClient *pgh.MockClient) {
				commits := []pgh.Commit{
					{
						Ref:     "abc123",
						Message: "Update dashboard",
						Author: &pgh.CommitAuthor{
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

func TestGitHubRepository_Webhook(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		webhookSecret string
		setupRequest  func() *http.Request
		mockSetup     func(t *testing.T, mockSecrets *secrets.MockService)
		expected      *provisioning.WebhookResponse
		expectedError error
	}{
		{
			name: "missing webhook configuration",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					// No webhook configuration
				},
			},
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", nil)
				return req
			},
			expectedError: fmt.Errorf("unexpected webhook request"),
		},
		{
			name: "secret decryption error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", nil)
				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return(nil, errors.New("decryption failed"))
			},
			expectedError: fmt.Errorf("failed to decrypt secret: decryption failed"),
		},
		{
			name: "invalid signature",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader("invalid payload"))
				req.Header.Set("X-Hub-Signature-256", "invalid")
				req.Header.Set("Content-Type", "application/json")
				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: apierrors.NewUnauthorized("invalid signature"),
		},
		{
			name: "ping event",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "ping")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ping received",
			},
		},
		{
			name: "push event for different branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: true,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/feature",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusOK,
			},
		},
		{
			name: "push event for main branch",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: true,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull: &provisioning.SyncJobOptions{
						Incremental: true,
					},
				},
			},
		},
		{
			name: "push event with missing repository",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main"
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("missing repository in push event"),
		},
		{
			name: "push event with repository mismatch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "different-owner/different-repo"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("repository mismatch"),
		},
		{
			name: "push event when sync is disabled",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: false,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusOK,
			},
		},
		{
			name: "pull request event - opened",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusAccepted,
				Message: "pull request: opened",
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPullRequest,
					PullRequest: &provisioning.PullRequestJobOptions{
						URL:  "https://github.com/grafana/grafana/pull/123",
						PR:   123,
						Ref:  "feature-branch",
						Hash: "abcdef1234567890",
					},
				},
			},
		},
		{
			name: "pull request event - synchronize",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "synchronize",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusAccepted,
				Message: "pull request: synchronize",
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPullRequest,
					PullRequest: &provisioning.PullRequestJobOptions{
						URL:  "https://github.com/grafana/grafana/pull/123",
						PR:   123,
						Ref:  "feature-branch",
						Hash: "abcdef1234567890",
					},
				},
			},
		},
		{
			name: "pull request event - wrong base branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "develop"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignoring pull request event as develop is not  the configured branch",
			},
		},
		{
			name: "pull request event - ignored action",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "closed",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignore pull request event: closed",
			},
		},
		{
			name: "pull request event missing repository",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("missing repository in pull request event"),
		},
		{
			name: "pull request event with missing GitHub config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					// GitHub config is intentionally missing
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("missing GitHub config"),
		},
		{
			name: "pull request event with repository mismatch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/different-owner/different-repo/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "different-owner/different-repo"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("repository mismatch"),
		},
		{
			name: "pull request event missing pull request info",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("expected PR in event"),
		},
		{
			name: "unsupported event type",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				payload := `{}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "team")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusNotImplemented,
				Message: "unsupported messageType: team",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock secrets service
			mockSecrets := secrets.NewMockService(t)

			// Set up the mock expectations
			if tt.mockSetup != nil {
				tt.mockSetup(t, mockSecrets)
			}

			// Create a GitHub repository with the test config
			repo := &githubRepository{
				config:  tt.config,
				owner:   "grafana",
				repo:    "grafana",
				secrets: mockSecrets,
			}

			// Call the Webhook method
			response, err := repo.Webhook(context.Background(), tt.setupRequest())

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
				require.Equal(t, tt.expected.Code, response.Code)
				require.Equal(t, tt.expected.Message, response.Message)

				if tt.expected.Job != nil {
					require.NotNil(t, response.Job)
					require.Equal(t, tt.expected.Job.Action, response.Job.Action)
					if tt.expected.Job.Pull != nil {
						require.Equal(t, tt.expected.Job.Pull.Incremental, response.Job.Pull.Incremental)
					}
					if tt.expected.Job.PullRequest != nil {
						require.Equal(t, tt.expected.Job.PullRequest.URL, response.Job.PullRequest.URL)
						require.Equal(t, tt.expected.Job.PullRequest.PR, response.Job.PullRequest.PR)
						require.Equal(t, tt.expected.Job.PullRequest.Ref, response.Job.PullRequest.Ref)
						require.Equal(t, tt.expected.Job.PullRequest.Hash, response.Job.PullRequest.Hash)
					}
				} else {
					require.Nil(t, response.Job)
				}
			}

			// Verify all mock expectations were met
			mockSecrets.AssertExpectations(t)
		})
	}
}
