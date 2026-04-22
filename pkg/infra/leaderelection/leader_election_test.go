package leaderelection

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

func TestNoopElector_RunCallsFnImmediately(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		le := NewNoopElector()
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()

		called := false
		done := make(chan error, 1)

		go func() {
			done <- le.Run(ctx, func(ctx context.Context) {
				called = true
				<-ctx.Done()
			})
		}()

		synctest.Wait()
		require.True(t, called, "fn should have been called immediately")

		cancel()
		synctest.Wait()

		require.ErrorIs(t, <-done, context.Canceled)
	})
}

func TestNoopElector_RunBlocksUntilCancelled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		le := NewNoopElector()
		ctx, cancel := context.WithCancel(t.Context())

		done := make(chan error, 1)
		go func() {
			done <- le.Run(ctx, func(ctx context.Context) {
				<-ctx.Done()
			})
		}()

		synctest.Wait()

		select {
		case <-done:
			t.Fatal("Run returned before context was cancelled")
		default:
		}

		cancel()
		synctest.Wait()

		require.ErrorIs(t, <-done, context.Canceled)
	})
}

var validConfig = Config{
	LeaseName:     "my-lease",
	Namespace:     "default",
	Identity:      "id-1",
	LeaseDuration: 15 * time.Second,
	RenewDeadline: 10 * time.Second,
	RetryPeriod:   2 * time.Second,
}

func TestNewKubernetesElector_RequiresLeaseName(t *testing.T) {
	cfg := validConfig
	cfg.LeaseName = ""
	_, err := NewKubernetesElector(&clientrest.Config{Host: "https://localhost:6443"}, cfg, &logtest.Fake{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "leader_election_lease_name")
}

func TestNewKubernetesElector_RequiresNamespace(t *testing.T) {
	cfg := validConfig
	cfg.Namespace = ""
	_, err := NewKubernetesElector(&clientrest.Config{Host: "https://localhost:6443"}, cfg, &logtest.Fake{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "leader_election_namespace")
}

func TestNewKubernetesElector_RequiresIdentity(t *testing.T) {
	cfg := validConfig
	cfg.Identity = ""
	_, err := NewKubernetesElector(&clientrest.Config{Host: "https://localhost:6443"}, cfg, &logtest.Fake{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "leader_election_identity")
}

func TestNewKubernetesElector_Success(t *testing.T) {
	le, err := NewKubernetesElector(&clientrest.Config{Host: "https://localhost:6443"}, validConfig, &logtest.Fake{})
	require.NoError(t, err)
	assert.NotNil(t, le)
}
