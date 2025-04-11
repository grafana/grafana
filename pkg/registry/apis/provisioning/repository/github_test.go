package repository

import (
	context "context"
	"fmt"
	"net/http"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
