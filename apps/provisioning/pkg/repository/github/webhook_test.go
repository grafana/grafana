package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	repo "github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestGithubWebhookParser_Parse(t *testing.T) {
	tests := []struct {
		file        string
		messageType string
		expected    repo.WebhookEvent
	}{
		{"webhook-ping-check.json", "ping", repo.WebhookEvent{Type: repo.WebhookEventPing}},
		{"webhook-pull_request-opened.json", "pull_request", repo.WebhookEvent{
			Type:      repo.WebhookEventPullRequest,
			RepoSlug:  "grafana/git-ui-sync-demo",
			Branch:    "main",
			Action:    "opened",
			PRNumber:  12,
			PRURL:     "https://github.com/grafana/git-ui-sync-demo/pull/12",
			SourceRef: "dashboard/1733653266690",
			Hash:      "ab5446a53df9e5f8bdeed52250f51fad08e822bc",
		}},
		{"webhook-push-keep_file_only.json", "push", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"empty-folder/.keep"},
			TotalChanges: 1,
		}},
		{"webhook-push-large_diff.json", "push", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			TotalChanges: 7,
		}},
		{"webhook-issue_comment-created.json", "issue_comment", repo.WebhookEvent{
			Type:    repo.WebhookEventUnsupported,
			Message: "unsupported messageType: issue_comment",
		}},
	}

	for _, tt := range tests {
		t.Run(tt.file, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(path.Join("testdata", tt.file))
			require.NoError(t, err)

			req, _ := http.NewRequest("POST", "/webhook", nil)
			req.Header.Set("X-GitHub-Event", tt.messageType)

			event, err := githubWebhookParser{}.Parse(req, payload)
			require.NoError(t, err)
			require.Equal(t, tt.expected, event)
		})
	}
}

func TestGithubWebhookParser_Parse_NormalizesSynchronize(t *testing.T) {
	payload := `{
		"action": "synchronize",
		"pull_request": {
			"html_url": "https://github.com/grafana/grafana/pull/1",
			"number": 1,
			"head": {"ref": "feature", "sha": "abc"},
			"base": {"ref": "main"}
		},
		"repository": {"full_name": "grafana/grafana"}
	}`
	req, _ := http.NewRequest("POST", "/webhook", nil)
	req.Header.Set("X-GitHub-Event", "pull_request")

	event, err := githubWebhookParser{}.Parse(req, []byte(payload))
	require.NoError(t, err)
	require.Equal(t, "updated", event.Action)
}

func TestGithubWebhookParser_Parse_Errors(t *testing.T) {
	tests := []struct {
		name        string
		messageType string
		payload     string
		expectedErr string
	}{
		{"push missing repository", "push", `{"ref": "refs/heads/main"}`, "missing repository in push event"},
		{"pull request missing repository", "pull_request", `{"action": "opened", "pull_request": {"number": 1}}`, "missing repository in pull request event"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("POST", "/webhook", nil)
			req.Header.Set("X-GitHub-Event", tt.messageType)

			_, err := githubWebhookParser{}.Parse(req, []byte(tt.payload))
			require.EqualError(t, err, tt.expectedErr)
		})
	}
}

func TestGithubWebhookParser_Verify(t *testing.T) {
	const secret = "webhook-secret"
	payload := `{"zen": "ok"}`

	sign := func(body, secret string) string {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(body))
		return "sha256=" + hex.EncodeToString(mac.Sum(nil))
	}

	t.Run("valid signature returns payload and signature replay key", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		signature := sign(payload, secret)
		req.Header.Set("X-Hub-Signature-256", signature)

		body, replayKey, err := githubWebhookParser{}.Verify(req, secret)
		require.NoError(t, err)
		require.Equal(t, payload, string(body))
		require.Equal(t, signature, replayKey)
	})

	t.Run("invalid signature is rejected", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Hub-Signature-256", "sha256=deadbeef")

		_, _, err := githubWebhookParser{}.Verify(req, secret)
		require.Error(t, err)
	})
}
