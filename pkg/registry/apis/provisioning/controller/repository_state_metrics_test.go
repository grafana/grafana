package controller

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func testRepository(namespace, name string, repoType provisioning.RepositoryType) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name},
		Spec: provisioning.RepositorySpec{
			Type: repoType,
			Sync: provisioning.SyncOptions{Enabled: true, Target: provisioning.SyncTargetTypeInstance},
		},
		Status: provisioning.RepositoryStatus{
			Health: provisioning.HealthStatus{Healthy: true},
			Sync:   provisioning.SyncStatus{Finished: 1_600_000_000_000},
			Stats: []provisioning.ResourceCount{
				{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 7},
				{Group: "folder.grafana.app", Resource: "folders", Count: 3},
			},
		},
	}
}

func TestRepositoryStateMetrics_Record(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))

	assert.Equal(t, 1.0, testutil.ToFloat64(m.info.WithLabelValues("stacks-1", "repo-a", "github", "instance")))
	assert.Equal(t, 1.0, testutil.ToFloat64(m.health.WithLabelValues("stacks-1", "repo-a")))
	assert.Equal(t, 1_600_000_000.0, testutil.ToFloat64(m.lastSync.WithLabelValues("stacks-1", "repo-a")))
	assert.Equal(t, 7.0, testutil.ToFloat64(m.managedResources.WithLabelValues("stacks-1", "repo-a", "dashboard.grafana.app", "dashboards")))
	assert.Equal(t, 3.0, testutil.ToFloat64(m.managedResources.WithLabelValues("stacks-1", "repo-a", "folder.grafana.app", "folders")))
}

func TestRepositoryStateMetrics_RecordUnhealthyAndNeverSynced(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	repo := testRepository("stacks-1", "repo-a", provisioning.GitRepositoryType)
	repo.Status.Health.Healthy = false
	repo.Status.Sync.Finished = 0

	m.Record(repo)

	assert.Equal(t, 0.0, testutil.ToFloat64(m.health.WithLabelValues("stacks-1", "repo-a")))
	// A repository that never finished a sync must not publish a bogus timestamp.
	assert.Equal(t, 0, testutil.CollectAndCount(m.lastSync))
}

func TestRepositoryStateMetrics_RecordDropsStaleResourceSeries(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	repo := testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType)
	m.Record(repo)
	require.Equal(t, 2, testutil.CollectAndCount(m.managedResources))

	// Folders drop out of the stats on the next sync.
	repo.Status.Stats = []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 9},
	}
	m.Record(repo)

	assert.Equal(t, 1, testutil.CollectAndCount(m.managedResources))
	assert.Equal(t, 9.0, testutil.ToFloat64(m.managedResources.WithLabelValues("stacks-1", "repo-a", "dashboard.grafana.app", "dashboards")))
}

func TestRepositoryStateMetrics_DoesNotCrossRepositories(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
	m.Record(testRepository("stacks-1", "repo-b", provisioning.GitRepositoryType))

	m.Delete("stacks-1", "repo-a")

	// repo-b is untouched; only repo-a's series are gone.
	assert.Equal(t, 1.0, testutil.ToFloat64(m.info.WithLabelValues("stacks-1", "repo-b", "git", "instance")))
	assert.Equal(t, 1, testutil.CollectAndCount(m.info))
	assert.Equal(t, 1, testutil.CollectAndCount(m.health))
	assert.Equal(t, 2, testutil.CollectAndCount(m.managedResources)) // only repo-b's two kinds remain
}

func TestRepositoryStateMetrics_Delete(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
	m.Delete("stacks-1", "repo-a")

	assert.Equal(t, 0, testutil.CollectAndCount(m.info))
	assert.Equal(t, 0, testutil.CollectAndCount(m.managedResources))
	assert.Equal(t, 0, testutil.CollectAndCount(m.health))
	assert.Equal(t, 0, testutil.CollectAndCount(m.lastSync))
}

func TestRepositoryStateMetrics_NilSafe(t *testing.T) {
	var m *repositoryStateMetrics
	assert.NotPanics(t, func() {
		m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
		m.Delete("stacks-1", "repo-a")
	})
}

func TestRepositoryStateMetrics_Exposition(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)
	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))

	expected := `
# HELP grafana_provisioning_repository_health Current health of a provisioning repository (1 = healthy, 0 = unhealthy).
# TYPE grafana_provisioning_repository_health gauge
grafana_provisioning_repository_health{name="repo-a",namespace="stacks-1"} 1
`
	err := testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_repository_health")
	require.NoError(t, err)
}

func TestTotalManagedResources(t *testing.T) {
	assert.Equal(t, int64(0), totalManagedResources(nil))
	assert.Equal(t, int64(10), totalManagedResources([]provisioning.ResourceCount{
		{Count: 7}, {Count: 3},
	}))
}
