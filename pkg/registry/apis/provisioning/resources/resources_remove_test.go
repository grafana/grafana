package resources

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const testRepoName = "test-repo"

func testRepoInfo() provisioning.ResourceRepositoryInfo {
	return provisioning.ResourceRepositoryInfo{Name: testRepoName}
}

// managedGrafanaObj builds an unstructured object with manager annotations
// matching testRepoName so that CheckResourceOwnership passes.
func managedGrafanaObj(name, namespace string, extraAnnotations map[string]any) *unstructured.Unstructured {
	annotations := map[string]any{
		utils.AnnoKeyManagerKind:     string(utils.ManagerKindRepo),
		utils.AnnoKeyManagerIdentity: testRepoName,
	}
	for k, v := range extraAnnotations {
		annotations[k] = v
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{
			"name":        name,
			"namespace":   namespace,
			"annotations": annotations,
		},
	}}
}

func TestRemoveResourceFromFile(t *testing.T) {
	dashboardGVK := schema.GroupVersionKind{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
		Kind:    "Dashboard",
	}

	t.Run("resource is deleted successfully", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "dashboards/my-dashboard.json"}
		repo.On("Read", mock.Anything, "dashboards/my-dashboard.json", "abc123").Return(fileInfo, nil)

		parsedObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "my-dashboard"},
		}}
		mockParser.On("Parse", mock.Anything, fileInfo).Return(&ParsedResource{
			Obj:    parsedObj,
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("my-dashboard", "default", map[string]any{
			utils.AnnoKeyFolder: "my-folder",
		})
		mockClient.On("Get", mock.Anything, "my-dashboard", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "my-dashboard", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, folderName, gvk, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/my-dashboard.json", "abc123")

		require.NoError(t, err)
		require.Equal(t, "my-dashboard", name)
		require.Equal(t, "my-folder", folderName)
		require.Equal(t, dashboardGVK, gvk)
	})

	t.Run("folder resource file is rejected by parser", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "folders/my-folder.json"}
		repo.On("Read", mock.Anything, "folders/my-folder.json", "abc123").Return(fileInfo, nil)

		mockParser.On("Parse", mock.Anything, fileInfo).
			Return(nil, NewResourceValidationError(errors.New("cannot declare folders through files")))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, _, err := mgr.RemoveResourceFromFile(context.Background(), "folders/my-folder.json", "abc123")

		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot declare folders through files")

		var validationErr *ResourceValidationError
		require.ErrorAs(t, err, &validationErr)
	})

	t.Run("non-resource file is rejected by parser", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		fileInfo := &repository.FileInfo{Data: []byte(`{"some_key": "some_value"}`), Path: "config/settings.json"}
		repo.On("Read", mock.Anything, "config/settings.json", "abc123").Return(fileInfo, nil)

		mockParser.On("Parse", mock.Anything, fileInfo).
			Return(nil, NewResourceValidationError(fmt.Errorf("file does not contain a valid resource")))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, _, err := mgr.RemoveResourceFromFile(context.Background(), "config/settings.json", "abc123")

		require.Error(t, err)
		require.Contains(t, err.Error(), "file does not contain a valid resource")

		var validationErr *ResourceValidationError
		require.ErrorAs(t, err, &validationErr)
	})

	t.Run("file read error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		repo.On("Read", mock.Anything, "dashboards/missing.json", "abc123").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, _, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/missing.json", "abc123")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to read file")
	})

	t.Run("already deleted resource is a no-op", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "dashboards/deleted.json"}
		repo.On("Read", mock.Anything, "dashboards/deleted.json", "abc123").Return(fileInfo, nil)

		parsedObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "deleted-dashboard"},
		}}
		mockParser.On("Parse", mock.Anything, fileInfo).Return(&ParsedResource{
			Obj:    parsedObj,
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		mockClient.On("Get", mock.Anything, "deleted-dashboard", metav1.GetOptions{}, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, "deleted-dashboard"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, _, gvk, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/deleted.json", "abc123")

		require.NoError(t, err)
		require.Equal(t, "deleted-dashboard", name)
		require.Equal(t, dashboardGVK, gvk)
	})

	t.Run("delete failure preserves name and GVK", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		fileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "dashboards/fail.json"}
		repo.On("Read", mock.Anything, "dashboards/fail.json", "abc123").Return(fileInfo, nil)

		parsedObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "fail-dashboard"},
		}}
		mockParser.On("Parse", mock.Anything, fileInfo).Return(&ParsedResource{
			Obj:    parsedObj,
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("fail-dashboard", "default", map[string]any{
			utils.AnnoKeyFolder: "some-folder",
		})
		mockClient.On("Get", mock.Anything, "fail-dashboard", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "fail-dashboard", metav1.DeleteOptions{}, mock.Anything).
			Return(fmt.Errorf("Folder cannot be deleted: folder is not empty"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, folderName, gvk, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/fail.json", "abc123")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to delete")
		require.Equal(t, "fail-dashboard", name, "name should be preserved on error")
		require.Equal(t, "some-folder", folderName, "folder should be preserved on error")
		require.Equal(t, dashboardGVK, gvk, "GVK should be preserved on error")
	})
}

func TestRenameResourceFile(t *testing.T) {
	dashboardGVK := schema.GroupVersionKind{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
		Kind:    "Dashboard",
	}

	t.Run("rename succeeds at remove step", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "old-path/dash.json"}
		repo.On("Read", mock.Anything, "old-path/dash.json", "old-ref").Return(oldFileInfo, nil)

		parsedObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "rename-uid"},
		}}
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj:    parsedObj,
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("rename-uid", "default", map[string]any{
			utils.AnnoKeyFolder: "src-folder",
		})
		mockClient.On("Get", mock.Anything, "rename-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "rename-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		// Second Parse call is for the write step (WriteResourceFromFile) — stub error to isolate remove step
		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "new-path/dash.json"}
		repo.On("Read", mock.Anything, "new-path/dash.json", "new-ref").Return(newFileInfo, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).
			Return(nil, fmt.Errorf("parse not implemented in test"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, _, err := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to write resource")
		require.NotContains(t, err.Error(), "file does not contain a valid resource",
			"remove step should have succeeded; error should be from the write step only")
	})
}
