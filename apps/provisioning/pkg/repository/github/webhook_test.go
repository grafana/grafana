package github

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/require"

	repo "github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const testWebhookSecret = "webhook-secret"

func TestGithubRequestProcessor_ProcessRequest(t *testing.T) {
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

			event, err := newTestRequestProcessor().ProcessRequest(context.Background(), signedWebhookRequest(t, tt.messageType, payload))
			require.NoError(t, err)
			require.Equal(t, tt.expected, event)
		})
	}
}

func TestGithubRequestProcessor_ProcessRequest_NormalizesSynchronize(t *testing.T) {
	payload := []byte(`{
		"action": "synchronize",
		"pull_request": {
			"html_url": "https://github.com/grafana/grafana/pull/1",
			"number": 1,
			"head": {"ref": "feature", "sha": "abc"},
			"base": {"ref": "main"}
		},
		"repository": {"full_name": "grafana/grafana"}
	}`)

	event, err := newTestRequestProcessor().ProcessRequest(context.Background(), signedWebhookRequest(t, "pull_request", payload))
	require.NoError(t, err)
	require.Equal(t, repo.PullRequestActionUpdated, event.Action)
}

func TestGithubRequestProcessor_ProcessRequest_Errors(t *testing.T) {
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
			_, err := newTestRequestProcessor().ProcessRequest(context.Background(), signedWebhookRequest(t, tt.messageType, []byte(tt.payload)))
			require.EqualError(t, err, tt.expectedErr)
		})
	}
}

func TestGithubRequestProcessor_ProcessRequest_Verify(t *testing.T) {
	t.Run("valid signature is accepted", func(t *testing.T) {
		event, err := newTestRequestProcessor().ProcessRequest(context.Background(), signedWebhookRequest(t, "ping", []byte(`{"zen": "ok"}`)))
		require.NoError(t, err)
		require.Equal(t, repo.WebhookEventPing, event.Type)
	})

	t.Run("invalid signature is rejected", func(t *testing.T) {
		req, err := http.NewRequest("POST", "/webhook", bytes.NewReader([]byte(`{"zen": "ok"}`)))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-GitHub-Event", "ping")
		req.Header.Set("X-Hub-Signature-256", "sha256=deadbeef")

		_, err = newTestRequestProcessor().ProcessRequest(context.Background(), req)
		require.Error(t, err)
	})

	t.Run("missing secret is rejected", func(t *testing.T) {
		p := requestProcessor{replay: newReplayCache(defaultReplayCacheTTL)}
		_, err := p.ProcessRequest(context.Background(), signedWebhookRequest(t, "ping", []byte(`{"zen": "ok"}`)))
		require.EqualError(t, err, "missing webhook secret")
	})
}

func TestGithubRequestProcessor_ProcessRequest_Replay(t *testing.T) {
	p := newTestRequestProcessor()
	payload := []byte(`{"zen": "ok"}`)

	first, err := p.ProcessRequest(context.Background(), signedWebhookRequest(t, "ping", payload))
	require.NoError(t, err)
	require.Equal(t, repo.WebhookEventPing, first.Type)

	replay, err := p.ProcessRequest(context.Background(), signedWebhookRequest(t, "ping", payload))
	require.NoError(t, err)
	require.Equal(t, repo.WebhookEventReplay, replay.Type)
}

func newTestRequestProcessor() requestProcessor {
	return requestProcessor{secret: common.RawSecureValue(testWebhookSecret), replay: newReplayCache(defaultReplayCacheTTL)}
}

func signedWebhookRequest(t *testing.T, eventType string, payload []byte) *http.Request {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(testWebhookSecret))
	mac.Write(payload)

	req, err := http.NewRequest("POST", "/webhook", bytes.NewReader(payload))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Event", eventType)
	req.Header.Set("X-Hub-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	return req
}
