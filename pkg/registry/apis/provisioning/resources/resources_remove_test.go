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

	t.Run("same name skips delete and updates in place", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "old-path/dash.json"}
		repo.On("Read", mock.Anything, "old-path/dash.json", "old-ref").Return(oldFileInfo, nil)

		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata":   map[string]any{"name": "same-uid"},
			}},
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		newObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "same-uid"},
		}}
		newMeta, err := utils.MetaAccessor(newObj)
		require.NoError(t, err)

		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "new-path/dash.json"}
		repo.On("Read", mock.Anything, "new-path/dash.json", "new-ref").Return(newFileInfo, nil)

		// writeResourceFromParsed reuses newParsed directly — no second parse.
		// Client is nil so Run returns an error, isolating the rename logic.
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(&ParsedResource{
			Obj:  newObj,
			Meta: newMeta,
			GVK:  dashboardGVK,
			Repo: testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("same-uid", "default", map[string]any{
			utils.AnnoKeyFolder: "old-folder",
		})
		mockClient.On("Get", mock.Anything, "same-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, folderName, _, err := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Error(t, err, "write step is expected to fail (no client)")
		require.Contains(t, err.Error(), "failed to write resource")
		require.Equal(t, "old-folder", folderName, "should return the previous folder for cleanup")

		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("different name deletes old then creates new", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "old-path/dash.json"}
		repo.On("Read", mock.Anything, "old-path/dash.json", "old-ref").Return(oldFileInfo, nil)

		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata":   map[string]any{"name": "old-uid"},
			}},
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		newObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "new-uid"},
		}}
		newMeta, err := utils.MetaAccessor(newObj)
		require.NoError(t, err)

		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "new-path/dash.json"}
		repo.On("Read", mock.Anything, "new-path/dash.json", "new-ref").Return(newFileInfo, nil)

		// writeResourceFromParsed reuses newParsed directly — no second parse.
		// Client is nil so Run returns an error, isolating the delete behaviour.
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(&ParsedResource{
			Obj:  newObj,
			Meta: newMeta,
			GVK:  dashboardGVK,
			Repo: testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("old-uid", "default", map[string]any{
			utils.AnnoKeyFolder: "src-folder",
		})
		mockClient.On("Get", mock.Anything, "old-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything).Return(nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, folderName, _, err := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Error(t, err, "write step fails (no client)")
		require.Contains(t, err.Error(), "failed to write resource")
		require.Equal(t, "src-folder", folderName, "should return the previous folder for cleanup")

		mockClient.AssertCalled(t, "Delete", mock.Anything, "old-uid", metav1.DeleteOptions{}, mock.Anything)
	})

	t.Run("new file parse error does not delete old resource", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "old-path/dash.json"}
		repo.On("Read", mock.Anything, "old-path/dash.json", "old-ref").Return(oldFileInfo, nil)

		oldParsedObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "safe-uid"},
		}}
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj:    oldParsedObj,
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "new-path/dash.json"}
		repo.On("Read", mock.Anything, "new-path/dash.json", "new-ref").Return(newFileInfo, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).
			Return(nil, fmt.Errorf("invalid json"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, _, err := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to parse new file")

		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("old file read error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)

		repo.On("Read", mock.Anything, "old-path/dash.json", "old-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, _, _, err := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to read previous file")
	})

	t.Run("folder name empty when resource does not exist in grafana", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "old-path/dash.json"}
		repo.On("Read", mock.Anything, "old-path/dash.json", "old-ref").Return(oldFileInfo, nil)

		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata":   map[string]any{"name": "dash-uid"},
			}},
			GVK:    dashboardGVK,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		newObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "dash-uid"},
		}}
		newMeta, err := utils.MetaAccessor(newObj)
		require.NoError(t, err)

		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "new-path/dash.json"}
		repo.On("Read", mock.Anything, "new-path/dash.json", "new-ref").Return(newFileInfo, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(&ParsedResource{
			Obj:  newObj,
			Meta: newMeta,
			GVK:  dashboardGVK,
			Repo: testRepoInfo(),
		}, nil)

		mockClient.On("Get", mock.Anything, "dash-uid", metav1.GetOptions{}, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, "dash-uid"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, folderName, _, err := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Error(t, err, "write step fails (no client on newParsed)")
		require.Contains(t, err.Error(), "failed to write resource")
		require.Empty(t, folderName, "folder should be empty when resource does not exist in grafana")
		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("same parent folder after rename suppresses old folder signal", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		dashClient := &MockDynamicResourceInterface{}

		config := newTestRepoConfig(testRepoName)
		repo.On("Config").Return(config)

		expectedFolderID := ParseFolder("team/", testRepoName).ID

		tree := NewEmptyFolderTree()
		tree.Add(ParseFolder("team/", testRepoName), "")
		folderMgr := NewFolderManager(repo, nil, tree, FolderKind)

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "team/old-dash.json"}
		repo.On("Read", mock.Anything, "team/old-dash.json", "old-ref").Return(oldFileInfo, nil)
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata":   map[string]any{"name": "dash-uid", "namespace": "default"},
			}},
			GVK:    dashboardGVK,
			GVR:    DashboardResource,
			Client: dashClient,
			Repo:   testRepoInfo(),
		}, nil)

		newObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "dash-uid", "namespace": "default"},
		}}
		newMeta, err := utils.MetaAccessor(newObj)
		require.NoError(t, err)

		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "team/new-dash.json"}
		repo.On("Read", mock.Anything, "team/new-dash.json", "new-ref").Return(newFileInfo, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(&ParsedResource{
			Obj:    newObj,
			Meta:   newMeta,
			GVK:    dashboardGVK,
			GVR:    DashboardResource,
			Client: dashClient,
			Repo:   testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("dash-uid", "default", map[string]any{
			utils.AnnoKeyFolder: expectedFolderID,
		})
		dashClient.On("Get", mock.Anything, "dash-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		dashClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(newObj, nil)

		mgr := NewResourcesManager(repo, folderMgr, mockParser, nil)
		name, folderName, gvk, err := mgr.RenameResourceFile(context.Background(), "team/old-dash.json", "old-ref", "team/new-dash.json", "new-ref")

		require.NoError(t, err)
		require.Equal(t, "dash-uid", name)
		require.Empty(t, folderName, "should suppress old folder signal when parent folder didn't change")
		require.Equal(t, dashboardGVK, gvk)
	})

	t.Run("different parent folder after rename returns old folder for cleanup", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		dashClient := &MockDynamicResourceInterface{}

		config := newTestRepoConfig(testRepoName)
		repo.On("Config").Return(config)

		oldFolderID := ParseFolder("a-team/", testRepoName).ID
		newFolderID := ParseFolder("b-team/", testRepoName).ID

		tree := NewEmptyFolderTree()
		tree.Add(ParseFolder("b-team/", testRepoName), "")
		folderMgr := NewFolderManager(repo, nil, tree, FolderKind)

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "a-team/dash.json"}
		repo.On("Read", mock.Anything, "a-team/dash.json", "old-ref").Return(oldFileInfo, nil)
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata":   map[string]any{"name": "dash-uid", "namespace": "default"},
			}},
			GVK:    dashboardGVK,
			GVR:    DashboardResource,
			Client: dashClient,
			Repo:   testRepoInfo(),
		}, nil)

		newObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "dash-uid", "namespace": "default"},
		}}
		newMeta, err := utils.MetaAccessor(newObj)
		require.NoError(t, err)

		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "b-team/dash.json"}
		repo.On("Read", mock.Anything, "b-team/dash.json", "new-ref").Return(newFileInfo, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(&ParsedResource{
			Obj:    newObj,
			Meta:   newMeta,
			GVK:    dashboardGVK,
			GVR:    DashboardResource,
			Client: dashClient,
			Repo:   testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("dash-uid", "default", map[string]any{
			utils.AnnoKeyFolder: oldFolderID,
		})
		dashClient.On("Get", mock.Anything, "dash-uid", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		dashClient.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(newObj, nil)

		mgr := NewResourcesManager(repo, folderMgr, mockParser, nil)
		name, folderName, gvk, err := mgr.RenameResourceFile(context.Background(), "a-team/dash.json", "old-ref", "b-team/dash.json", "new-ref")

		require.NoError(t, err)
		require.Equal(t, "dash-uid", name)
		require.Equal(t, oldFolderID, folderName, "should return old folder for cleanup when parent folder changed")
		require.NotEqual(t, newFolderID, folderName)
		require.Equal(t, dashboardGVK, gvk)
	})

	// Pure path-only renames (git blob hash unchanged) skip strict server-side
	// validation: the spec already lives in the cluster and may legitimately
	// fail rules introduced after it was first persisted. A synthetic GVR is
	// used so the SupportsFolderAnnotation path and the v1-dashboard exemption
	// do not interfere with the assertion.
	fakeGVK := schema.GroupVersionKind{Group: "fake.grafana.app", Version: "v1", Kind: "Fake"}
	fakeGVR := schema.GroupVersionResource{Group: "fake.grafana.app", Version: "v1", Resource: "fakes"}

	makeRenameMocks := func(t *testing.T, oldHash, newHash string) (*repository.MockReaderWriter, *MockParser, *MockDynamicResourceInterface, *unstructured.Unstructured) {
		t.Helper()
		repo := repository.NewMockReaderWriter(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		oldFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "old/x.json", Hash: oldHash}
		repo.On("Read", mock.Anything, "old/x.json", "old-ref").Return(oldFileInfo, nil)
		mockParser.On("Parse", mock.Anything, oldFileInfo).Return(&ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "fake.grafana.app/v1",
				"kind":       "Fake",
				"metadata":   map[string]any{"name": "same-name"},
			}},
			GVK:    fakeGVK,
			GVR:    fakeGVR,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		newObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "fake.grafana.app/v1",
			"kind":       "Fake",
			"metadata":   map[string]any{"name": "same-name"},
		}}
		newMeta, err := utils.MetaAccessor(newObj)
		require.NoError(t, err)
		newFileInfo := &repository.FileInfo{Data: []byte(`{}`), Path: "new/x.json", Hash: newHash}
		repo.On("Read", mock.Anything, "new/x.json", "new-ref").Return(newFileInfo, nil)
		mockParser.On("Parse", mock.Anything, newFileInfo).Return(&ParsedResource{
			Obj:    newObj,
			Meta:   newMeta,
			GVK:    fakeGVK,
			GVR:    fakeGVR,
			Client: mockClient,
			Repo:   testRepoInfo(),
		}, nil)

		grafanaObj := managedGrafanaObj("same-name", "default", nil)
		mockClient.On("Get", mock.Anything, "same-name", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)
		return repo, mockParser, mockClient, newObj
	}

	t.Run("same identity rename with unchanged hash sends FieldValidation Ignore", func(t *testing.T) {
		repo, mockParser, mockClient, newObj := makeRenameMocks(t, "blob-1", "blob-1")
		mockClient.On("Update", mock.Anything, newObj, metav1.UpdateOptions{FieldValidation: "Ignore"}, mock.Anything).
			Return(newObj, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, _, _, err := mgr.RenameResourceFile(context.Background(), "old/x.json", "old-ref", "new/x.json", "new-ref")

		require.NoError(t, err)
		require.Equal(t, "same-name", name)
		mockClient.AssertCalled(t, "Update", mock.Anything, newObj, metav1.UpdateOptions{FieldValidation: "Ignore"}, mock.Anything)
		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("same identity rename with changed hash keeps FieldValidation Strict", func(t *testing.T) {
		repo, mockParser, mockClient, newObj := makeRenameMocks(t, "blob-1", "blob-2")
		mockClient.On("Update", mock.Anything, newObj, metav1.UpdateOptions{FieldValidation: "Strict"}, mock.Anything).
			Return(newObj, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, _, _, err := mgr.RenameResourceFile(context.Background(), "old/x.json", "old-ref", "new/x.json", "new-ref")

		require.NoError(t, err)
		require.Equal(t, "same-name", name)
		mockClient.AssertCalled(t, "Update", mock.Anything, newObj, metav1.UpdateOptions{FieldValidation: "Strict"}, mock.Anything)
		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("same identity rename with empty hashes keeps FieldValidation Strict", func(t *testing.T) {
		// Defensive case: if Hash is unavailable on either side, fall back to
		// strict validation rather than silently bypassing it.
		repo, mockParser, mockClient, newObj := makeRenameMocks(t, "", "")
		mockClient.On("Update", mock.Anything, newObj, metav1.UpdateOptions{FieldValidation: "Strict"}, mock.Anything).
			Return(newObj, nil)

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		name, _, _, err := mgr.RenameResourceFile(context.Background(), "old/x.json", "old-ref", "new/x.json", "new-ref")

		require.NoError(t, err)
		require.Equal(t, "same-name", name)
		mockClient.AssertCalled(t, "Update", mock.Anything, newObj, metav1.UpdateOptions{FieldValidation: "Strict"}, mock.Anything)
	})
}
