package webhooks

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
)

type stubWebhookRepo struct {
	cfg    *provisioning.Repository
	slug   string
	branch string
	event  repository.WebhookEvent
	err    error
}

func (s stubWebhookRepo) Config() *provisioning.Repository { return s.cfg }
func (s stubWebhookRepo) Test(context.Context) (*provisioning.TestResults, error) {
	return nil, nil
}
func (s stubWebhookRepo) Slug() string   { return s.slug }
func (s stubWebhookRepo) Branch() string { return s.branch }
func (s stubWebhookRepo) ProcessRequest(context.Context, *http.Request) (repository.WebhookEvent, error) {
	return s.event, s.err
}

func TestWebhookConnector_webhook(t *testing.T) {
	tests := []struct {
		name          string
		noStatus      bool
		syncDisabled  bool
		event         repository.WebhookEvent
		processErr    error
		expected      *provisioning.WebhookResponse
		expectedError error
	}{
		{
			name:          "missing webhook status",
			noStatus:      true,
			expectedError: fmt.Errorf("unexpected webhook request"),
		},
		{
			name:          "verification failure",
			processErr:    apierrors.NewUnauthorized("invalid signature"),
			expectedError: apierrors.NewUnauthorized("invalid signature"),
		},
		{
			name:          "parse failure",
			processErr:    fmt.Errorf("invalid payload"),
			expectedError: fmt.Errorf("invalid payload"),
		},
		{
			name:          "push repository mismatch",
			event:         repository.WebhookEvent{Type: repository.WebhookEventPush, RepoSlug: "other/repo", Branch: "main"},
			expectedError: repository.ErrRepositoryMismatch,
		},
		{
			name:         "push sync disabled",
			syncDisabled: true,
			event:        repository.WebhookEvent{Type: repository.WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main"},
			expected:     &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:     "push other branch",
			event:    repository.WebhookEvent{Type: repository.WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "feature"},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:  "push accepted",
			event: repository.WebhookEvent{Type: repository.WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 1},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Action: provisioning.JobActionPull,
					Pull:   &provisioning.SyncJobOptions{Incremental: true},
				},
			},
		},
		{
			name:          "pull request repository mismatch",
			event:         repository.WebhookEvent{Type: repository.WebhookEventPullRequest, RepoSlug: "other/repo", Branch: "main"},
			expectedError: repository.ErrRepositoryMismatch,
		},
		{
			name:  "pull request other branch",
			event: repository.WebhookEvent{Type: repository.WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "develop"},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignoring pull request event as develop is not  the configured branch",
			},
		},
		{
			name:  "pull request ignored action",
			event: repository.WebhookEvent{Type: repository.WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "main", Action: "closed"},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignore pull request event: closed",
			},
		},
		{
			name: "pull request accepted",
			event: repository.WebhookEvent{
				Type:      repository.WebhookEventPullRequest,
				RepoSlug:  "grafana/grafana",
				Branch:    "main",
				Action:    repository.PullRequestActionOpened,
				PRNumber:  123,
				PRURL:     "https://github.com/grafana/grafana/pull/123",
				SourceRef: "feature-branch",
				Hash:      "abcdef",
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusAccepted,
				Message: "pull request: opened",
				Job: &provisioning.JobSpec{
					Action: provisioning.JobActionPullRequest,
					PullRequest: &provisioning.PullRequestJobOptions{
						URL:  "https://github.com/grafana/grafana/pull/123",
						PR:   123,
						Ref:  "feature-branch",
						Hash: "abcdef",
					},
				},
			},
		},
		{
			name:     "ping",
			event:    repository.WebhookEvent{Type: repository.WebhookEventPing},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ping received"},
		},
		{
			name:     "unsupported",
			event:    repository.WebhookEvent{Type: repository.WebhookEventUnsupported, Message: "unsupported messageType: team"},
			expected: &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: "unsupported messageType: team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Enabled: !tt.syncDisabled}},
			}
			if !tt.noStatus {
				cfg.Status.Webhook = &provisioning.WebhookStatus{}
			}
			hooks := stubWebhookRepo{cfg: cfg, slug: "grafana/grafana", branch: "main", event: tt.event, err: tt.processErr}

			s := &webhookConnector{core: &provisioningapis.APIBuilder{}, replayCache: newReplayCache(time.Hour)}
			rsp, err := s.webhook(t.Context(), &http.Request{}, hooks)

			if tt.expectedError != nil {
				require.Error(t, err)
				if expected, ok := errors.AsType[*apierrors.StatusError](tt.expectedError); ok {
					actual, ok := errors.AsType[*apierrors.StatusError](err)
					require.True(t, ok, "expected StatusError, got %T", err)
					require.Equal(t, expected.Status().Message, actual.Status().Message)
					require.Equal(t, expected.Status().Code, actual.Status().Code)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected.Code, rsp.Code)
			require.Equal(t, tt.expected.Message, rsp.Message)
			require.Equal(t, tt.expected.Job, rsp.Job)
		})
	}
}

func TestWebhookConnector_webhook_replay(t *testing.T) {
	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		Spec:       provisioning.RepositorySpec{Sync: provisioning.SyncOptions{Enabled: true}},
		Status:     provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{}},
	}
	event := repository.WebhookEvent{Type: repository.WebhookEventPush, ReplayKey: "sig", RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 1}
	hooks := stubWebhookRepo{cfg: cfg, slug: "grafana/grafana", branch: "main", event: event}

	s := &webhookConnector{core: &provisioningapis.APIBuilder{}, replayCache: newReplayCache(time.Hour)}

	first, err := s.webhook(t.Context(), &http.Request{}, hooks)
	require.NoError(t, err)
	require.Equal(t, http.StatusAccepted, first.Code)

	// Replaying the same key is silently dropped with a generic 200 and no job.
	dup, err := s.webhook(t.Context(), &http.Request{}, hooks)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, dup.Code)
	require.Nil(t, dup.Job)

	// An empty replay key is never treated as a duplicate.
	hooks.event.ReplayKey = ""
	for i := 0; i < 2; i++ {
		rsp, err := s.webhook(t.Context(), &http.Request{}, hooks)
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rsp.Code)
	}
}

type fakeStatusPatcher struct {
	called bool
	err    error
}

func (f *fakeStatusPatcher) Patch(_ context.Context, _ *provisioning.Repository, _ ...map[string]interface{}) error {
	f.called = true
	return f.err
}

func TestUpdateLastEvent(t *testing.T) {
	t.Run("nil Webhook returns early without panicking or patching", func(t *testing.T) {
		patcher := &fakeStatusPatcher{}
		cfg := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "repo", Namespace: "default"},
			Status:     provisioning.RepositoryStatus{Webhook: nil},
		}

		require.NotPanics(t, func() {
			err := updateLastEvent(context.Background(), cfg, patcher)
			assert.NoError(t, err)
		})
		assert.False(t, patcher.called, "patcher must not be called when Webhook is nil")
	})

	t.Run("recent LastEvent skips patch", func(t *testing.T) {
		patcher := &fakeStatusPatcher{}
		cfg := &provisioning.Repository{
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{
					LastEvent: time.Now().UnixMilli(),
				},
			},
		}

		err := updateLastEvent(context.Background(), cfg, patcher)
		assert.NoError(t, err)
		assert.False(t, patcher.called, "patcher must not be called when LastEvent is recent")
	})

	t.Run("stale LastEvent triggers patch", func(t *testing.T) {
		patcher := &fakeStatusPatcher{}
		cfg := &provisioning.Repository{
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{
					LastEvent: time.Now().Add(-2 * time.Minute).UnixMilli(),
				},
			},
		}

		err := updateLastEvent(context.Background(), cfg, patcher)
		assert.NoError(t, err)
		assert.True(t, patcher.called, "patcher must be called when LastEvent is stale")
	})

	t.Run("patch error is wrapped", func(t *testing.T) {
		patcher := &fakeStatusPatcher{err: errors.New("boom")}
		cfg := &provisioning.Repository{
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{
					LastEvent: time.Now().Add(-2 * time.Minute).UnixMilli(),
				},
			},
		}

		err := updateLastEvent(context.Background(), cfg, patcher)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "patch status")
		assert.ErrorContains(t, err, "boom")
	})
}
