package local

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// The metrics singleton binds to the first registry it is given, so the whole
// test binary shares this one.
var (
	metricsRegistry = prometheus.NewRegistry()
	testMetrics     = repository.RegisterOperationMetrics(metricsRegistry)
)

// TestLocalRepository_OperationMetrics pins the contract that callers rely on:
// every operation on the repository interface is observed once, by the
// repository itself, with no help from the caller.
func TestLocalRepository_OperationMetrics(t *testing.T) {
	ctx := context.Background()
	tempDir := t.TempDir()

	repo := NewRepository(&provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type:  provisioning.LocalRepositoryType,
			Local: &provisioning.LocalRepositoryConfig{Path: tempDir},
		},
	}, &LocalFolderResolver{PermittedPrefixes: []string{tempDir}, HomePath: tempDir}, testMetrics)

	before := snapshot(t)

	require.NoError(t, repo.Create(ctx, "dashboard.json", "", []byte("0123456789"), "create"))
	require.NoError(t, repo.Update(ctx, "dashboard.json", "", []byte("updated"), "update"))
	require.NoError(t, repo.Write(ctx, "other.json", "", []byte("written"), "write"))

	info, err := repo.Read(ctx, "dashboard.json", "")
	require.NoError(t, err)
	require.Equal(t, []byte("updated"), info.Data)

	_, err = repo.ReadTree(ctx, "")
	require.NoError(t, err)
	require.NoError(t, repo.Move(ctx, "other.json", "moved.json", "", "move"))
	require.NoError(t, repo.Delete(ctx, "moved.json", "", "delete"))

	after := snapshot(t)

	assert.Equal(t, 3.0, after.count(repository.OperationWrite, "success")-before.count(repository.OperationWrite, "success"))
	assert.Equal(t, 1.0, after.count(repository.OperationRead, "success")-before.count(repository.OperationRead, "success"))
	assert.Equal(t, 1.0, after.count(repository.OperationList, "success")-before.count(repository.OperationList, "success"))
	assert.Equal(t, 1.0, after.count(repository.OperationMove, "success")-before.count(repository.OperationMove, "success"))
	assert.Equal(t, 1.0, after.count(repository.OperationDelete, "success")-before.count(repository.OperationDelete, "success"))

	// 10 created + 7 updated + 7 written on the way in, 7 read back out.
	assert.Equal(t, 24.0, after.size(repository.OperationWrite)-before.size(repository.OperationWrite))
	assert.Equal(t, 7.0, after.size(repository.OperationRead)-before.size(repository.OperationRead))

	t.Run("failures are recorded as errors", func(t *testing.T) {
		before := snapshot(t)

		_, err := repo.Read(ctx, "missing.json", "")
		require.ErrorIs(t, err, repository.ErrFileNotFound)
		require.Error(t, repo.Delete(ctx, "missing.json", "", "delete"))

		after := snapshot(t)
		assert.Equal(t, 1.0, after.count(repository.OperationRead, "error")-before.count(repository.OperationRead, "error"))
		assert.Equal(t, 1.0, after.count(repository.OperationDelete, "error")-before.count(repository.OperationDelete, "error"))
		assert.Equal(t, 0.0, after.size(repository.OperationRead)-before.size(repository.OperationRead),
			"a failed read has no size to report")
	})
}

// metricSnapshot holds the local-repository operation samples at a point in
// time, so assertions can be made on deltas rather than absolute values.
type metricSnapshot struct {
	counts map[string]float64
	sizes  map[string]float64
}

func (s metricSnapshot) count(operation, outcome string) float64 {
	return s.counts[operation+"/"+outcome]
}

func (s metricSnapshot) size(operation string) float64 {
	return s.sizes[operation]
}

func snapshot(t *testing.T) metricSnapshot {
	t.Helper()
	families, err := metricsRegistry.Gather()
	require.NoError(t, err)

	out := metricSnapshot{counts: map[string]float64{}, sizes: map[string]float64{}}
	for _, f := range families {
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["repository_type"] != string(provisioning.LocalRepositoryType) {
				continue
			}
			switch f.GetName() {
			case "grafana_provisioning_repository_operations_total":
				out.counts[labels["operation"]+"/"+labels["outcome"]] = m.GetCounter().GetValue()
			case "grafana_provisioning_repository_operation_size_bytes":
				out.sizes[labels["operation"]] = m.GetHistogram().GetSampleSum()
			}
		}
	}
	return out
}
