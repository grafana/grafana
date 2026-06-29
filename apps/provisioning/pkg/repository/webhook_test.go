package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestWebhookHandler_Webhook(t *testing.T) {
	tests := []struct {
		name          string
		noStatus      bool
		syncDisabled  bool
		event         WebhookEvent
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
			event:         WebhookEvent{Type: WebhookEventPush, RepoSlug: "other/repo", Branch: "main"},
			expectedError: ErrRepositoryMismatch,
		},
		{
			name:         "push sync disabled",
			syncDisabled: true,
			event:        WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main"},
			expected:     &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:     "push other branch",
			event:    WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "feature"},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:  "push accepted",
			event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 1},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull:       &provisioning.SyncJobOptions{Incremental: true},
				},
			},
		},
		{
			name:  "push large diff forces full sync",
			event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 7},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull:       &provisioning.SyncJobOptions{Incremental: false},
				},
			},
		},
		{
			name:          "pull request repository mismatch",
			event:         WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "other/repo", Branch: "main"},
			expectedError: ErrRepositoryMismatch,
		},
		{
			name:  "pull request other branch",
			event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "develop"},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignoring pull request event as develop is not  the configured branch",
			},
		},
		{
			name:  "pull request ignored action",
			event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "main", Action: "closed"},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignore pull request event: closed",
			},
		},
		{
			name: "pull request accepted",
			event: WebhookEvent{
				Type:      WebhookEventPullRequest,
				RepoSlug:  "grafana/grafana",
				Branch:    "main",
				Action:    PullRequestActionOpened,
				PRNumber:  123,
				PRURL:     "https://github.com/grafana/grafana/pull/123",
				SourceRef: "feature-branch",
				Hash:      "abcdef",
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
						Hash: "abcdef",
					},
				},
			},
		},
		{
			name:     "ping",
			event:    WebhookEvent{Type: WebhookEventPing},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ping received"},
		},
		{
			name:     "replay",
			event:    WebhookEvent{Type: WebhookEventReplay},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ok"},
		},
		{
			name:     "unsupported",
			event:    WebhookEvent{Type: WebhookEventUnsupported, Message: "unsupported messageType: team"},
			expected: &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: "unsupported messageType: team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var status *provisioning.WebhookStatus
			if !tt.noStatus {
				status = &provisioning.WebhookStatus{}
			}
			processReqFunc := func(context.Context, *http.Request) (WebhookEvent, error) {
				return tt.event, tt.processErr
			}

			h := NewWebhookHandler(processReqFunc, status, "test-repo", "grafana/grafana", "main", !tt.syncDisabled, NewIncrementalSyncPolicy(false, 5))

			rsp, err := h.Webhook(t.Context(), &http.Request{})

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
