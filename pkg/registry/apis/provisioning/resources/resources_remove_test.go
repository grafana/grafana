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

		oldParsedObj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "new-uid"},
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
			Return(nil, fmt.Errorf("stub error"))

		mockClient.On("Get", mock.Anything, "new-uid", metav1.GetOptions{}, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, "new-uid"))

		mgr := NewResourcesManager(repo, nil, mockParser, nil)
		_, folderName, _, _ := mgr.RenameResourceFile(context.Background(), "old-path/dash.json", "old-ref", "new-path/dash.json", "new-ref")

		require.Empty(t, folderName, "folder should be empty when resource does not exist")
	})
}

func TestSameIdentity(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "dashboard.grafana.app", Version: "v0alpha1", Kind: "Dashboard"}

	makeParsed := func(name, group, kind string) *ParsedResource {
		return &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": name},
			}},
			GVK: schema.GroupVersionKind{Group: group, Kind: kind},
		}
	}

	t.Run("true when name, group, and kind match", func(t *testing.T) {
		a := makeParsed("dash-1", gvk.Group, gvk.Kind)
		b := makeParsed("dash-1", gvk.Group, gvk.Kind)
		require.True(t, a.SameIdentity(b))
	})

	t.Run("false when name differs", func(t *testing.T) {
		a := makeParsed("dash-1", gvk.Group, gvk.Kind)
		b := makeParsed("dash-2", gvk.Group, gvk.Kind)
		require.False(t, a.SameIdentity(b))
	})

	t.Run("false when group differs", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		b := makeParsed("dash-1", "folder.grafana.app", "Dashboard")
		require.False(t, a.SameIdentity(b))
	})

	t.Run("false when kind differs", func(t *testing.T) {
		a := makeParsed("dash-1", gvk.Group, "Dashboard")
		b := makeParsed("dash-1", gvk.Group, "Folder")
		require.False(t, a.SameIdentity(b))
	})

	t.Run("ignores version difference", func(t *testing.T) {
		a := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{"metadata": map[string]any{"name": "x"}}},
			GVK: schema.GroupVersionKind{Group: "g", Version: "v1", Kind: "K"},
		}
		b := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{"metadata": map[string]any{"name": "x"}}},
			GVK: schema.GroupVersionKind{Group: "g", Version: "v2", Kind: "K"},
		}
		require.True(t, a.SameIdentity(b))
	})
}

func TestFetchExisting(t *testing.T) {
	t.Run("no-op when Existing is already set", func(t *testing.T) {
		existing := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "already-here"},
		}}
		parsed := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}},
			Existing: existing,
		}

		require.NoError(t, parsed.FetchExisting(context.Background()))
		require.Same(t, existing, parsed.Existing, "Existing should not be replaced")
	})

	t.Run("no-op when Client is nil", func(t *testing.T) {
		parsed := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}},
		}

		require.NoError(t, parsed.FetchExisting(context.Background()))
		require.Nil(t, parsed.Existing)
	})

	t.Run("populates Existing when resource is found", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		grafanaObj := managedGrafanaObj("my-resource", "default", nil)
		mockClient.On("Get", mock.Anything, "my-resource", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)

		parsed := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}},
			Client: mockClient,
		}

		require.NoError(t, parsed.FetchExisting(context.Background()))
		require.NotNil(t, parsed.Existing)
		require.Equal(t, "my-resource", parsed.Existing.GetName())
	})

	t.Run("NotFound leaves Existing nil without error", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		mockClient.On("Get", mock.Anything, "missing", metav1.GetOptions{}, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, "missing"))

		parsed := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "missing", "namespace": "default"},
			}},
			Client: mockClient,
		}

		require.NoError(t, parsed.FetchExisting(context.Background()))
		require.Nil(t, parsed.Existing)
	})

	t.Run("non-NotFound error is propagated", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		mockClient.On("Get", mock.Anything, "broken", metav1.GetOptions{}, mock.Anything).
			Return(nil, fmt.Errorf("connection refused"))

		parsed := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "broken", "namespace": "default"},
			}},
			Client: mockClient,
		}

		err := parsed.FetchExisting(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to get existing resource")
		require.Contains(t, err.Error(), "connection refused")
		require.Nil(t, parsed.Existing)
	})
}
