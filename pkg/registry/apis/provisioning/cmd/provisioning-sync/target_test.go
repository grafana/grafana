package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func pullCondition(status metav1.ConditionStatus) metav1.Condition {
	return metav1.Condition{Type: provisioning.ConditionTypePullStatus, Status: status, Reason: "Test"}
}

// The state file receives the same patch sequence the sync worker sends to the status subresource.
func TestStateFileAppliesSyncWorkerPatches(t *testing.T) {
	state := &stateFile{path: filepath.Join(t.TempDir(), "nested", "state.json")}
	repo := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Name: "demo", Namespace: "default"}}

	require.NoError(t, state.patch(t.Context(), repo,
		map[string]interface{}{"op": "replace", "path": "/status/sync/state", "value": provisioning.JobStateWorking},
		map[string]interface{}{"op": "replace", "path": "/status/sync/job", "value": "job-1"},
		map[string]interface{}{"op": "replace", "path": "/status/sync/started", "value": int64(100)},
	))
	assert.Equal(t, provisioning.JobStateWorking, repo.Status.Sync.State)
	assert.Equal(t, "job-1", repo.Status.Sync.JobID)

	conditionOps := controller.BuildConditionPatchOpsFromExisting(repo.Status.Conditions, 0, pullCondition(metav1.ConditionTrue))
	require.NoError(t, state.patch(t.Context(), repo, append([]map[string]interface{}{
		{"op": "replace", "path": "/status/sync", "value": provisioning.SyncStatus{State: provisioning.JobStateSuccess, JobID: "job-1", LastRef: "abc123"}},
		{"op": "replace", "path": "/status/stats", "value": []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2}}},
	}, conditionOps...)...))

	assert.Equal(t, "abc123", repo.Status.Sync.LastRef)
	require.Len(t, repo.Status.Conditions, 1)
	assert.Equal(t, metav1.ConditionTrue, repo.Status.Conditions[0].Status)

	updated := controller.BuildConditionPatchOpsFromExisting(repo.Status.Conditions, 0, pullCondition(metav1.ConditionFalse))
	require.NoError(t, state.patch(t.Context(), repo, updated...))
	require.Len(t, repo.Status.Conditions, 1)
	assert.Equal(t, metav1.ConditionFalse, repo.Status.Conditions[0].Status)

	reloaded := &provisioning.Repository{}
	require.NoError(t, state.load(reloaded))
	assert.Equal(t, repo.Status, reloaded.Status, "the next run starts from the saved status")
}

func TestLoadTargetFromFlagsReadsStateFile(t *testing.T) {
	stateDir := t.TempDir()
	statePath := filepath.Join(stateDir, "state.json")
	require.NoError(t, os.WriteFile(statePath, []byte(`{"sync":{"state":"success","lastRef":"saved-ref"}}`), 0o600))

	opts := options{repoType: "local", path: t.TempDir(), name: "demo", namespace: "default", stateFile: statePath, offline: true}
	tgt, err := loadTarget(opts)
	require.NoError(t, err)
	assert.Equal(t, "demo", tgt.cfg.Name)
	assert.Equal(t, "saved-ref", tgt.cfg.Status.Sync.LastRef)
	assert.Nil(t, tgt.lister, "an offline dry run has nothing to list")

	opts.fromRef = "override-ref"
	tgt, err = loadTarget(opts)
	require.NoError(t, err)
	assert.Equal(t, "override-ref", tgt.cfg.Status.Sync.LastRef)

	t.Run("a missing state file starts from an empty status", func(t *testing.T) {
		opts := options{repoType: "local", path: t.TempDir(), namespace: "default", stateFile: filepath.Join(t.TempDir(), "none.json"), offline: true}
		tgt, err := loadTarget(opts)
		require.NoError(t, err)
		assert.Empty(t, tgt.cfg.Status.Sync.LastRef)
	})

	t.Run("a corrupt state file is an error", func(t *testing.T) {
		corrupt := filepath.Join(t.TempDir(), "corrupt.json")
		require.NoError(t, os.WriteFile(corrupt, []byte(`{`), 0o600))
		opts := options{repoType: "local", path: t.TempDir(), namespace: "default", stateFile: corrupt, offline: true}
		_, err := loadTarget(opts)
		require.ErrorContains(t, err, "parse state file")
	})
}

func managedDashboard(t *testing.T, gvk schema.GroupVersionKind, name string, managerKind utils.ManagerKind, identity, path string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": gvk.GroupVersion().String(),
		"kind":       gvk.Kind,
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       map[string]any{"title": name + " title"},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	if managerKind != "" {
		meta.SetManagerProperties(utils.ManagerProperties{Kind: managerKind, Identity: identity})
		meta.SetSourceProperties(utils.SourceProperties{Path: path, Checksum: "sum-" + name})
	}
	return obj
}

func TestManagedResourceListerKeepsOnlyTheRepositorysResources(t *testing.T) {
	gvr := schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "dashboards"}
	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Version: "v1", Kind: "Dashboard"}

	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(gvk, &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(gvk.GroupVersion().WithKind("DashboardList"), &unstructured.UnstructuredList{})
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{gvr: "DashboardList"},
		managedDashboard(t, gvk, "mine-1", utils.ManagerKindRepo, "demo", "a.json"),
		managedDashboard(t, gvk, "mine-2", utils.ManagerKindRepo, "demo", "team/b.json"),
		managedDashboard(t, gvk, "other-repo", utils.ManagerKindRepo, "another", "c.json"),
		managedDashboard(t, gvk, "same-id-other-manager", utils.ManagerKindFileProvisioning, "demo", "d.json"),
		managedDashboard(t, gvk, "unmanaged", "", "", ""),
	)

	clients := resources.NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]resources.SupportedResource{{GroupKind: gvk.GroupKind()}})
	clients.EXPECT().ForKind(mock.Anything, gvk.GroupKind().WithVersion("")).Return(dyn.Resource(gvr).Namespace("default"), gvr, nil)
	factory := resources.NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil)

	lister := &managedResourceLister{clients: factory}

	list, err := lister.List(t.Context(), "default", "demo", resources.ListOptions{})
	require.NoError(t, err)
	assert.ElementsMatch(t, []provisioning.ResourceListItem{
		{Path: "a.json", Group: gvr.Group, Resource: gvr.Resource, Name: "mine-1", Hash: "sum-mine-1", Title: "mine-1 title"},
		{Path: "team/b.json", Group: gvr.Group, Resource: gvr.Resource, Name: "mine-2", Hash: "sum-mine-2", Title: "mine-2 title"},
	}, list.Items)

	stats, err := lister.RepositoryStats(t.Context(), "default", "demo")
	require.NoError(t, err)
	assert.Equal(t, []provisioning.ResourceCount{{Group: gvr.Group, Resource: gvr.Resource, Count: 2}}, stats)
}
