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

func TestRepositoryStateMetrics_AggregatesByType(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
	m.Record(testRepository("stacks-2", "repo-b", provisioning.GitHubRepositoryType))
	m.Record(testRepository("stacks-3", "repo-c", provisioning.GitRepositoryType))

	expected := `
# HELP grafana_provisioning_repositories Number of provisioning repositories, by type.
# TYPE grafana_provisioning_repositories gauge
grafana_provisioning_repositories{type="git"} 1
grafana_provisioning_repositories{type="github"} 2
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_repositories"))
}

func TestRepositoryStateMetrics_ManagedResourcesSumAcrossRepositories(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
	m.Record(testRepository("stacks-2", "repo-b", provisioning.GitRepositoryType))

	// Two repos, each with 7 dashboards + 3 folders → 14 and 6 in aggregate.
	expected := `
# HELP grafana_provisioning_managed_resources Number of resources managed by provisioning repositories, by group and resource, as of each repository's last sync.
# TYPE grafana_provisioning_managed_resources gauge
grafana_provisioning_managed_resources{group="dashboard.grafana.app",resource="dashboards"} 14
grafana_provisioning_managed_resources{group="folder.grafana.app",resource="folders"} 6
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_managed_resources"))
}

func TestRepositoryStateMetrics_Unhealthy(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	healthy := testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType)
	unhealthy := testRepository("stacks-2", "repo-b", provisioning.GitHubRepositoryType)
	unhealthy.Status.Health.Healthy = false
	m.Record(healthy)
	m.Record(unhealthy)

	// The unhealthy series is present (0) for a type even when all its repos are
	// healthy, but here one github repo is unhealthy.
	expected := `
# HELP grafana_provisioning_repositories_unhealthy Number of provisioning repositories currently unhealthy, by type.
# TYPE grafana_provisioning_repositories_unhealthy gauge
grafana_provisioning_repositories_unhealthy{type="github"} 1
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_repositories_unhealthy"))
}

func TestRepositoryStateMetrics_Delete(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
	m.Record(testRepository("stacks-2", "repo-b", provisioning.GitRepositoryType))
	m.Delete("stacks-1", "repo-a")

	// Only repo-b (git) remains; github series disappears entirely.
	expected := `
# HELP grafana_provisioning_repositories Number of provisioning repositories, by type.
# TYPE grafana_provisioning_repositories gauge
grafana_provisioning_repositories{type="git"} 1
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_repositories"))
	assert.Equal(t, 2, testutil.CollectAndCount(m, "grafana_provisioning_managed_resources"))
}

func TestRepositoryStateMetrics_RecordDoesNotAliasCacheObject(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	repo := testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType)
	m.Record(repo)

	// Mutating the object after Record must not change the recorded snapshot.
	repo.Status.Stats[0].Count = 999

	expected := `
# HELP grafana_provisioning_managed_resources Number of resources managed by provisioning repositories, by group and resource, as of each repository's last sync.
# TYPE grafana_provisioning_managed_resources gauge
grafana_provisioning_managed_resources{group="dashboard.grafana.app",resource="dashboards"} 7
grafana_provisioning_managed_resources{group="folder.grafana.app",resource="folders"} 3
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_managed_resources"))
}

func TestRepositoryStateMetrics_ReRecordReplacesSnapshot(t *testing.T) {
	reg := prometheus.NewRegistry()
	m := registerRepositoryStateMetrics(reg)

	repo := testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType)
	m.Record(repo)

	// Next sync drops folders and grows dashboards.
	repo.Status.Stats = []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 9},
	}
	m.Record(repo)

	expected := `
# HELP grafana_provisioning_managed_resources Number of resources managed by provisioning repositories, by group and resource, as of each repository's last sync.
# TYPE grafana_provisioning_managed_resources gauge
grafana_provisioning_managed_resources{group="dashboard.grafana.app",resource="dashboards"} 9
`
	require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(expected), "grafana_provisioning_managed_resources"))
}

func TestRepositoryStateMetrics_NilSafe(t *testing.T) {
	var m *repositoryStateMetrics
	assert.NotPanics(t, func() {
		m.Record(testRepository("stacks-1", "repo-a", provisioning.GitHubRepositoryType))
		m.Delete("stacks-1", "repo-a")
	})
}

func TestTotalManagedResources(t *testing.T) {
	assert.Equal(t, int64(0), totalManagedResources(nil))
	assert.Equal(t, int64(10), totalManagedResources([]provisioning.ResourceCount{
		{Count: 7}, {Count: 3},
	}))
}
