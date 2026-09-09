package git

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/nanogit/metrics"
)

// TestClientMetrics_Recorder pins the bridge from nanogit's metrics.Recorder to
// the Prometheus vectors: each signal lands on the right series, labelled with
// the repository type the recorder was built for.
func TestClientMetrics_Recorder(t *testing.T) {
	ctx := context.Background()

	t.Run("nil ClientMetrics yields a nil recorder", func(t *testing.T) {
		var m *ClientMetrics
		assert.Nil(t, m.Recorder(provisioning.GitRepositoryType))
	})

	t.Run("HTTP requests are counted per operation and status code", func(t *testing.T) {
		m := newClientMetrics(prometheus.NewRegistry())
		rec := m.Recorder(provisioning.GitRepositoryType)

		rec.HTTPRequest(ctx, metrics.OperationUploadPack, 200, 5*time.Millisecond, 1)
		rec.HTTPRequest(ctx, metrics.OperationUploadPack, 200, 5*time.Millisecond, 1)
		rec.HTTPRequest(ctx, metrics.OperationSmartInfo, 401, time.Millisecond, 1)

		assert.Equal(t, 2.0, testutil.ToFloat64(m.httpRequests.WithLabelValues("git", metrics.OperationUploadPack, "200")))
		assert.Equal(t, 1.0, testutil.ToFloat64(m.httpRequests.WithLabelValues("git", metrics.OperationSmartInfo, "401")))
		assert.Equal(t, 2, testutil.CollectAndCount(m.httpDuration))
	})

	t.Run("only attempts past the first count as retries", func(t *testing.T) {
		m := newClientMetrics(prometheus.NewRegistry())
		rec := m.Recorder(provisioning.GitRepositoryType)

		rec.HTTPRequest(ctx, metrics.OperationUploadPack, 500, time.Millisecond, 1)
		rec.HTTPRequest(ctx, metrics.OperationUploadPack, 500, time.Millisecond, 2)
		rec.HTTPRequest(ctx, metrics.OperationUploadPack, 200, time.Millisecond, 3)

		assert.Equal(t, 2.0, testutil.ToFloat64(m.httpRetries.WithLabelValues("git", metrics.OperationUploadPack)))
	})

	t.Run("fetched objects and bytes accumulate", func(t *testing.T) {
		m := newClientMetrics(prometheus.NewRegistry())
		rec := m.Recorder(provisioning.GitRepositoryType)

		rec.ObjectsFetched(ctx, 10, 2048)
		rec.ObjectsFetched(ctx, 5, 1024)

		assert.Equal(t, 15.0, testutil.ToFloat64(m.objectsFetched.WithLabelValues("git")))
		assert.Equal(t, 3072.0, testutil.ToFloat64(m.fetchedBytes.WithLabelValues("git")))
	})

	t.Run("cache access is split by hit and miss", func(t *testing.T) {
		m := newClientMetrics(prometheus.NewRegistry())
		rec := m.Recorder(provisioning.GitRepositoryType)

		rec.CacheAccess(ctx, true)
		rec.CacheAccess(ctx, true)
		rec.CacheAccess(ctx, false)

		assert.Equal(t, 2.0, testutil.ToFloat64(m.cacheAccesses.WithLabelValues("git", "hit")))
		assert.Equal(t, 1.0, testutil.ToFloat64(m.cacheAccesses.WithLabelValues("git", "miss")))
	})

	t.Run("labels follow the configured repository type", func(t *testing.T) {
		m := newClientMetrics(prometheus.NewRegistry())
		m.Recorder(provisioning.GitHubRepositoryType).CacheAccess(ctx, true)

		assert.Equal(t, 1.0, testutil.ToFloat64(m.cacheAccesses.WithLabelValues("github", "hit")))
		assert.Equal(t, 0.0, testutil.ToFloat64(m.cacheAccesses.WithLabelValues("git", "hit")))
	})
}

// TestGitRepository_InjectsClientRecorder pins that the repository puts its
// recorder on the context nanogit operates on, so nanogit's FromContext finds it
// instead of the noop fallback. This is what makes the whole family record
// without touching any nanogit call site.
func TestGitRepository_InjectsClientRecorder(t *testing.T) {
	m := newClientMetrics(prometheus.NewRegistry())
	repo := &gitRepository{
		gitConfig:     RepositoryConfig{Branch: "main"},
		config:        &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType}},
		clientMetrics: m.Recorder(provisioning.GitRepositoryType),
	}

	ctx, _ := repo.withGitContext(context.Background(), "main")
	require.Same(t, repo.clientMetrics, metrics.FromContext(ctx))

	// A repository with no metrics leaves the context on nanogit's noop fallback.
	bare := &gitRepository{
		gitConfig: RepositoryConfig{Branch: "main"},
		config:    &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType}},
	}
	bareCtx, _ := bare.withGitContext(context.Background(), "main")
	assert.IsType(t, &metrics.NoopRecorder{}, metrics.FromContext(bareCtx))
}

// TestRegisterClientMetrics_Idempotent pins that registration binds once and
// never panics on a second call, the way the process wiring relies on (two
// binaries, and the operator's early-return paths, all call it).
func TestRegisterClientMetrics_Idempotent(t *testing.T) {
	first := RegisterClientMetrics(prometheus.NewRegistry())
	second := RegisterClientMetrics(prometheus.NewRegistry())
	assert.Same(t, first, second, "registration binds to the first registry and returns that instance")
}
