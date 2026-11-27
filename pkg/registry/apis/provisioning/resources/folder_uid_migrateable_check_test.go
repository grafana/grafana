package resources

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestEnsureFolderExists_PendingTakeover(t *testing.T) {
	const (
		folderID = "pending-folder"
		repoName = "test-repo"
	)

	newRepo := func(t *testing.T) *repository.MockReaderWriter {
		repo := repository.NewMockReaderWriter(t)
		repo.On("Config").Return(newTestRepoConfig(repoName))
		return repo
	}

	markedFolder := func(markedBy string) *unstructured.Unstructured {
		annotations := map[string]interface{}{}
		if markedBy != "" {
			annotations[AnnoKeyPendingTakeover] = markedBy
		}
		return &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1beta1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name":        folderID,
					"namespace":   "default",
					"annotations": annotations,
				},
				"spec": map[string]interface{}{"title": "Existing Title"},
			},
		}
	}

	newClient := func(markedBy string, counts []folderv1.ResourceStats) (*countsClient, **unstructured.Unstructured) {
		var updated *unstructured.Unstructured
		client := &countsClient{
			fakeDynamicResourceClient: &fakeDynamicResourceClient{
				getFn: func(string) (*unstructured.Unstructured, error) {
					return markedFolder(markedBy), nil
				},
				updateFn: func(obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
					updated = obj.DeepCopy()
					return obj, nil
				},
			},
			counts: map[string][]folderv1.ResourceStats{folderID: counts},
		}
		return client, &updated
	}

	newManager := func(repo repository.ReaderWriter, client *countsClient, enabled bool) *FolderManager {
		fm := NewFolderManager(repo, client, NewEmptyFolderTree(), FolderKind)
		fm.takeoverEnabled = func(context.Context, string) bool { return enabled }
		return fm
	}

	folder := Folder{ID: folderID, Title: "New Title", Path: "team/"}
	dashboards := []folderv1.ResourceStats{{Group: DashboardResource.Group, Resource: DashboardResource.Resource, Count: 2}}

	t.Run("claims a folder marked for this repository and removes the marker", func(t *testing.T) {
		client, updated := newClient(repoName, dashboards)
		fm := newManager(newRepo(t), client, true)

		require.NoError(t, fm.EnsureFolderExists(context.Background(), folder, ""))

		require.Equal(t, []string{folderID}, client.updateCalls)
		require.NotNil(t, *updated)
		meta, err := utils.MetaAccessor(*updated)
		require.NoError(t, err)
		manager, managed := meta.GetManagerProperties()
		require.True(t, managed)
		require.Equal(t, repoName, manager.Identity)
		require.NotContains(t, (*updated).GetAnnotations(), AnnoKeyPendingTakeover)
	})

	rejected := []struct {
		name     string
		markedBy string
		counts   []folderv1.ResourceStats
		enabled  bool
		countErr error
	}{
		{name: "no marker", markedBy: "", counts: dashboards, enabled: true},
		{name: "marker for another repository", markedBy: "other-repo", counts: dashboards, enabled: true},
		{name: "feature flag off", markedBy: repoName, counts: dashboards, enabled: false},
		{
			name:     "alert rule added during review",
			markedBy: repoName,
			counts:   []folderv1.ResourceStats{{Group: "sql-fallback", Resource: "alertrules", Count: 1}},
			enabled:  true,
		},
		{name: "counts are not available", markedBy: repoName, enabled: true, countErr: errors.New("boom")},
	}
	for _, tt := range rejected {
		t.Run("rejects when "+tt.name, func(t *testing.T) {
			client, _ := newClient(tt.markedBy, tt.counts)
			client.countsErr = tt.countErr
			fm := newManager(newRepo(t), client, tt.enabled)

			err := fm.EnsureFolderExists(context.Background(), folder, "")

			var unmanagedErr *ResourceUnmanagedConflictError
			require.ErrorAs(t, err, &unmanagedErr)
			require.Empty(t, client.updateCalls)
		})
	}
}
