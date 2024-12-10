package repository

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
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
				Action: provisioning.JobActionPullRequest,
				Ref:    "dashboard/1733653266690",
				Hash:   "ab5446a53df9e5f8bdeed52250f51fad08e822bc",
				PR:     12,
				URL:    "https://github.com/grafana/git-ui-sync-demo/pull/12",
			},
		}},
		{"push", "ignored", provisioning.WebhookResponse{
			Code: http.StatusOK, // parsed but nothing required
		}},
		{"push", "nested", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{
				Action: provisioning.JobActionMergeBranch,
				Commits: []provisioning.CommitInfo{{
					SHA1: "5c816f9812e391c62b0c5555d0b473b296d9179c",
					Added: []provisioning.FileRef{
						{
							Ref:  "5c816f9812e391c62b0c5555d0b473b296d9179c",
							Path: "nested-1/dash-1.json",
						},
						{
							Ref:  "5c816f9812e391c62b0c5555d0b473b296d9179c",
							Path: "nested-1/nested-2/dash-2.json",
						},
					},
					Modified: []provisioning.FileRef{
						{
							Ref:  "5c816f9812e391c62b0c5555d0b473b296d9179c",
							Path: "first-dashboard.json",
						},
					},
				}},
			},
		}},
		{"issue_comment", "created", provisioning.WebhookResponse{
			Code: http.StatusNotImplemented,
		}},
	}

	gh := &githubRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				GitHub: &provisioning.GitHubRepositoryConfig{
					Repository: "git-ui-sync-demo",
					Owner:      "grafana",
					Branch:     "main",

					GenerateDashboardPreviews: true,
					PullRequestLinter:         true,
				},
			},
		},
		logger: slog.Default().With("logger", "github-repository"),
		ignore: provisioning.IncludeYamlOrJSON,
	}

	for _, tt := range tests {
		name := fmt.Sprintf("webhook-%s-%s.json", tt.messageType, tt.name)
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(filepath.Join("github", "testdata", name))
			require.NoError(t, err)

			rsp, err := gh.parseWebhook(tt.messageType, payload)
			require.NoError(t, err)

			require.Equal(t, tt.expected.Code, rsp.Code)
			require.Equal(t, tt.expected.Job, rsp.Job)
		})
	}
}
