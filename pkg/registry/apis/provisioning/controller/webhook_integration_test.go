package controller

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"path"
	"strconv"
	"sync"
	"testing"

	"github.com/google/go-github/v82/github"
	mockhub "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	githubrepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationWebhookController_ReconcileLifecycle drives the controller's
// webhook hooks (webhookOnCreate -> webhookOnUpdate -> webhookOnDelete) across
// several reconcile passes against the REAL github webhook client talking to a
// stateful GitHub mock. Unlike the unit tests (which mock repository.WebhookClient),
// this exercises the full controller-to-provider path, including the 422
// "hook already exists" self-heal that lets a repo recover a lost Status.Webhook.
func TestIntegrationWebhookController_ReconcileLifecycle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		owner      = "test-owner"
		repoName   = "test-repo"
		repoURL    = "https://github.com/test-owner/test-repo"
		webhookURL = "https://grafana.example.com/webhook"
	)

	// Stateful in-memory hook store modelling GitHub's uniqueness-by-payload-URL:
	// a second create for an existing URL returns 422, matching real GitHub.
	var (
		mu     sync.Mutex
		hooks  []*github.Hook
		nextID int64
	)
	findByURL := func(url string) *github.Hook {
		for _, h := range hooks {
			if h.GetConfig().GetURL() == url {
				return h
			}
		}
		return nil
	}

	mockHandler := mockhub.NewMockedHTTPClient(
		mockhub.WithRequestMatchHandler(
			mockhub.PostReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				defer mu.Unlock()

				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				in := &github.Hook{}
				require.NoError(t, json.Unmarshal(body, in))
				url := in.GetConfig().GetURL()

				if findByURL(url) != nil {
					w.WriteHeader(http.StatusUnprocessableEntity)
					require.NoError(t, json.NewEncoder(w).Encode(github.ErrorResponse{
						Response: &http.Response{StatusCode: http.StatusUnprocessableEntity},
						Message:  "Validation Failed",
						Errors: []github.Error{
							{Resource: "Hook", Code: "custom", Message: "Hook already exists on this repository"},
						},
					}))
					return
				}

				nextID++
				created := &github.Hook{
					ID:     github.Ptr(nextID),
					Events: in.Events,
					Active: github.Ptr(in.GetActive()),
					Config: &github.HookConfig{
						URL:         github.Ptr(url),
						ContentType: github.Ptr(in.GetConfig().GetContentType()),
					},
				}
				hooks = append(hooks, created)
				w.WriteHeader(http.StatusCreated)
				require.NoError(t, json.NewEncoder(w).Encode(created))
			}),
		),
		mockhub.WithRequestMatchHandler(
			mockhub.GetReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				mu.Lock()
				defer mu.Unlock()
				w.WriteHeader(http.StatusOK)
				require.NoError(t, json.NewEncoder(w).Encode(hooks))
			}),
		),
		mockhub.WithRequestMatchHandler(
			mockhub.PatchReposHooksByOwnerByRepoByHookId,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				defer mu.Unlock()

				id, err := strconv.ParseInt(path.Base(r.URL.Path), 10, 64)
				require.NoError(t, err)
				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				edit := &github.Hook{}
				require.NoError(t, json.Unmarshal(body, edit))

				var matched *github.Hook
				for _, h := range hooks {
					if h.GetID() == id {
						h.Events = edit.Events
						h.Active = github.Ptr(edit.GetActive())
						h.Config = &github.HookConfig{
							URL:         github.Ptr(edit.GetConfig().GetURL()),
							ContentType: github.Ptr("json"),
						}
						matched = h
						break
					}
				}
				require.NotNilf(t, matched, "PATCH for unknown hook id %d", id)
				w.WriteHeader(http.StatusOK)
				require.NoError(t, json.NewEncoder(w).Encode(matched))
			}),
		),
		mockhub.WithRequestMatchHandler(
			mockhub.DeleteReposHooksByOwnerByRepoByHookId,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				defer mu.Unlock()

				id, err := strconv.ParseInt(path.Base(r.URL.Path), 10, 64)
				require.NoError(t, err)
				remaining := hooks[:0]
				for _, h := range hooks {
					if h.GetID() != id {
						remaining = append(remaining, h)
					}
				}
				hooks = remaining
				w.WriteHeader(http.StatusNoContent)
			}),
		),
	)

	// Real github client (no custom server URL, so the default github.com API
	// paths match mockhub's matchers). It satisfies repository.WebhookClient.
	factory := githubrepo.ProvideFactory()
	factory.Client = mockHandler
	ghClient, err := factory.New(context.Background(), owner, repoName, "")
	require.NoError(t, err)

	// A repo whose spec enables a workflow so the hooks actually register a webhook.
	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type:      provisioning.GitHubRepositoryType,
			Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
			GitHub:    &provisioning.GitHubRepositoryConfig{URL: repoURL, Branch: "main"},
		},
	}

	// WebhookRepository shell: config/URL/events are test data, but WebhookClient
	// is the real github client so the hooks hit the mock GitHub over HTTP.
	repo := repository.NewMockWebhookRepository(t)
	repo.EXPECT().Config().Return(config).Maybe()
	repo.EXPECT().WebhookURL().Return(webhookURL).Maybe()
	repo.EXPECT().SubscribedEvents().Return(subscribedEvents).Maybe()
	repo.EXPECT().WebhookClient().Return(ghClient).Maybe()

	ctx := context.Background()

	// applyStatus mimics the controller persisting the hooks' returned status patch.
	applyStatus := func(patches []map[string]any) {
		for _, p := range patches {
			if p["path"] != "/status/webhook" {
				continue
			}
			if p["value"] == nil {
				config.Status.Webhook = nil
				continue
			}
			status, ok := p["value"].(*provisioning.WebhookStatus)
			require.True(t, ok, "unexpected status patch value type")
			config.Status.Webhook = status
		}
	}

	// secretFromPatches extracts the webhook secret carried by the
	// /secure/webhookSecret patch that accompanies every status update — the
	// secret is persisted to the secure store, not into Status.Webhook itself.
	secretFromPatches := func(patches []map[string]any) string {
		for _, p := range patches {
			if p["path"] != "/secure/webhookSecret" {
				continue
			}
			v, ok := p["value"].(map[string]string)
			require.True(t, ok, "unexpected webhookSecret patch value type")
			return v["create"]
		}
		return ""
	}

	// Pass 1 — OnCreate registers the webhook.
	patches, err := webhookOnCreate(ctx, repo)
	require.NoError(t, err)
	require.NotEmpty(t, patches, "OnCreate should register a webhook and return status patches")
	applyStatus(patches)
	require.NotNil(t, config.Status.Webhook)
	createdID := config.Status.Webhook.ID
	assert.NotZero(t, createdID)
	createdSecret := secretFromPatches(patches)
	assert.NotEmpty(t, createdSecret, "OnCreate should persist a webhook secret")
	mu.Lock()
	assert.Len(t, hooks, 1, "OnCreate should create exactly one hook")
	mu.Unlock()

	// Simulate Status.Webhook being lost while the hook still lives on the remote.
	config.Status.Webhook = nil

	// Pass 2 — OnUpdate must self-heal: create hits GitHub's 422 (URL exists) and
	// adopts the existing hook by URL, recovering the same ID without duplicating.
	patches, err = webhookOnUpdate(ctx, repo)
	require.NoError(t, err)
	require.NotEmpty(t, patches, "OnUpdate should re-adopt the existing hook and return status patches")
	applyStatus(patches)
	require.NotNil(t, config.Status.Webhook)
	assert.Equal(t, createdID, config.Status.Webhook.ID, "adopt must recover the same hook ID, not create a new one")
	adoptedSecret := secretFromPatches(patches)
	assert.NotEmpty(t, adoptedSecret, "self-heal should persist a webhook secret")
	assert.NotEqual(t, createdSecret, adoptedSecret, "self-heal should rotate to a fresh webhook secret")
	mu.Lock()
	assert.Len(t, hooks, 1, "self-heal must not create a duplicate hook")
	mu.Unlock()

	// Pass 3 — OnDelete removes the remote hook.
	require.NoError(t, webhookOnDelete(ctx, repo))
	mu.Lock()
	assert.Empty(t, hooks, "OnDelete must remove the remote hook")
	mu.Unlock()
}
