package webhooks

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

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
