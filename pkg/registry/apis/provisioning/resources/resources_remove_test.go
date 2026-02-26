package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestRemoveResourceFromFile(t *testing.T) {
	dashboardGVK := schema.GroupVersionKind{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
		Kind:    "Dashboard",
	}

	t.Run("k8s formatted resource is deleted successfully", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		k8sResource := map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name": "my-dashboard",
			},
			"spec": map[string]any{
				"title": "My Dashboard",
			},
		}
		data, _ := json.Marshal(k8sResource)

		repo.On("Read", mock.Anything, "dashboards/my-dashboard.json", "abc123").
			Return(&repository.FileInfo{Data: data, Path: "dashboards/my-dashboard.json"}, nil)

		clients.On("ForKind", mock.Anything, dashboardGVK).
			Return(mockClient, schema.GroupVersionResource{}, nil)

		grafanaObj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name":      "my-dashboard",
					"namespace": "default",
					"annotations": map[string]any{
						utils.AnnoKeyFolder: "my-folder",
					},
				},
			},
		}
		mockClient.On("Get", mock.Anything, "my-dashboard", metav1.GetOptions{}, mock.Anything).
			Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "my-dashboard", metav1.DeleteOptions{}, mock.Anything).
			Return(nil)

		mgr := NewResourcesManager(repo, nil, nil, clients)
		name, folderName, gvk, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/my-dashboard.json", "abc123")

		require.NoError(t, err)
		require.Equal(t, "my-dashboard", name)
		require.Equal(t, "my-folder", folderName)
		// NOTE: RemoveResourceFromFile currently returns empty GVK on success (line 395 of resources.go).
		// This is a pre-existing issue separate from the classic dashboard fallback bug.
		require.Equal(t, schema.GroupVersionKind{}, gvk)
	})

	t.Run("classic dashboard format is deleted successfully", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		classicDashboard := map[string]any{
			"uid":           "classic-dash-uid",
			"title":         "Classic Dashboard",
			"schemaVersion": 7,
			"panels":        []any{},
			"tags":          []any{},
		}
		data, _ := json.Marshal(classicDashboard)

		repo.On("Read", mock.Anything, "dashboards/classic.json", "abc123").
			Return(&repository.FileInfo{Data: data, Path: "dashboards/classic.json"}, nil)

		clients.On("ForKind", mock.Anything, dashboardGVK).
			Return(mockClient, schema.GroupVersionResource{}, nil)

		grafanaObj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name":      "classic-dash-uid",
					"namespace": "default",
					"annotations": map[string]any{
						utils.AnnoKeyFolder: "my-folder",
					},
				},
			},
		}
		mockClient.On("Get", mock.Anything, "classic-dash-uid", metav1.GetOptions{}, mock.Anything).
			Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "classic-dash-uid", metav1.DeleteOptions{}, mock.Anything).
			Return(nil)

		mgr := NewResourcesManager(repo, nil, nil, clients)
		name, folderName, gvk, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/classic.json", "abc123")

		require.NoError(t, err, "classic dashboard format should be handled by RemoveResourceFromFile via ReadClassicResource fallback")
		require.Equal(t, "classic-dash-uid", name)
		require.Equal(t, "my-folder", folderName)
		// Same pre-existing GVK issue: RemoveResourceFromFile always returns empty GVK
		require.Equal(t, schema.GroupVersionKind{}, gvk)
	})

	t.Run("non-resource JSON file returns validation error", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)

		nonResource := map[string]any{
			"some_key":    "some_value",
			"another_key": 42,
		}
		data, _ := json.Marshal(nonResource)

		repo.On("Read", mock.Anything, "config/settings.json", "abc123").
			Return(&repository.FileInfo{Data: data, Path: "config/settings.json"}, nil)

		mgr := NewResourcesManager(repo, nil, nil, clients)
		_, _, _, err := mgr.RemoveResourceFromFile(context.Background(), "config/settings.json", "abc123")

		require.Error(t, err)
		require.Contains(t, err.Error(), "file does not contain a valid resource")

		var validationErr *ResourceValidationError
		require.ErrorAs(t, err, &validationErr, "should be a ResourceValidationError")
	})

	t.Run("file read error is propagated", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)

		repo.On("Read", mock.Anything, "dashboards/missing.json", "abc123").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound)

		mgr := NewResourcesManager(repo, nil, nil, clients)
		_, _, _, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/missing.json", "abc123")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to read file")
	})

	t.Run("already deleted resource is a no-op", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)
		mockClient := &MockDynamicResourceInterface{}

		k8sResource := map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name": "deleted-dashboard",
			},
		}
		data, _ := json.Marshal(k8sResource)

		repo.On("Read", mock.Anything, "dashboards/deleted.json", "abc123").
			Return(&repository.FileInfo{Data: data, Path: "dashboards/deleted.json"}, nil)

		clients.On("ForKind", mock.Anything, dashboardGVK).
			Return(mockClient, schema.GroupVersionResource{}, nil)

		mockClient.On("Get", mock.Anything, "deleted-dashboard", metav1.GetOptions{}, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, "deleted-dashboard"))

		mgr := NewResourcesManager(repo, nil, nil, clients)
		name, _, _, err := mgr.RemoveResourceFromFile(context.Background(), "dashboards/deleted.json", "abc123")

		require.NoError(t, err)
		require.Equal(t, "deleted-dashboard", name)
	})
}

func TestRenameResourceFile(t *testing.T) {
	dashboardGVK := schema.GroupVersionKind{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
		Kind:    "Dashboard",
	}

	// RenameResourceFile calls RemoveResourceFromFile (old path) then WriteResourceFromFile (new path).
	// The classic dashboard bug was in the remove step: it failed with "no object found" for classic-format files.
	// These tests verify the remove step succeeds for classic dashboards during a rename.
	//
	// NOTE: integration-level rename tests are not feasible because file renames are only detected
	// by Git-backed repositories (via CompareFiles), not by local filesystem repositories.

	t.Run("classic dashboard rename succeeds at remove step", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		classicDashboard := map[string]any{
			"uid":           "rename-classic-uid",
			"title":         "Classic Dashboard Being Renamed",
			"schemaVersion": 39,
			"panels":        []any{},
			"tags":          []any{},
		}
		data, _ := json.Marshal(classicDashboard)

		repo.On("Read", mock.Anything, "old-path/classic.json", "old-ref").
			Return(&repository.FileInfo{Data: data, Path: "old-path/classic.json"}, nil)

		clients.On("ForKind", mock.Anything, dashboardGVK).
			Return(mockClient, schema.GroupVersionResource{}, nil)

		grafanaObj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name":      "rename-classic-uid",
					"namespace": "default",
					"annotations": map[string]any{
						utils.AnnoKeyFolder: "src-folder",
					},
				},
			},
		}
		mockClient.On("Get", mock.Anything, "rename-classic-uid", metav1.GetOptions{}, mock.Anything).
			Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "rename-classic-uid", metav1.DeleteOptions{}, mock.Anything).
			Return(nil)

		// The write step reads and parses the new file; stub the parser to return an error
		// so we can isolate the test to the remove step.
		repo.On("Read", mock.Anything, "new-path/classic.json", "new-ref").
			Return(&repository.FileInfo{Data: data, Path: "new-path/classic.json"}, nil)
		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("parse not implemented in test"))

		mgr := NewResourcesManager(repo, nil, mockParser, clients)
		_, _, _, err := mgr.RenameResourceFile(context.Background(), "old-path/classic.json", "old-ref", "new-path/classic.json", "new-ref")

		// The error comes from the write step (stubbed parser), not from the remove step.
		// Before the fix, this would have failed with "file does not contain a valid resource"
		// from the remove step because classic dashboards were not recognized.
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to write resource")
		require.NotContains(t, err.Error(), "file does not contain a valid resource",
			"remove step should have succeeded for the classic dashboard; error should be from the write step only")
	})

	t.Run("k8s resource rename succeeds at remove step", func(t *testing.T) {
		repo := repository.NewMockReaderWriter(t)
		clients := NewMockResourceClients(t)
		mockParser := NewMockParser(t)
		mockClient := &MockDynamicResourceInterface{}

		k8sResource := map[string]any{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "rename-k8s-uid"},
			"spec":       map[string]any{"title": "K8s Dashboard Being Renamed"},
		}
		data, _ := json.Marshal(k8sResource)

		repo.On("Read", mock.Anything, "old-path/k8s.json", "old-ref").
			Return(&repository.FileInfo{Data: data, Path: "old-path/k8s.json"}, nil)

		clients.On("ForKind", mock.Anything, dashboardGVK).
			Return(mockClient, schema.GroupVersionResource{}, nil)

		grafanaObj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name":      "rename-k8s-uid",
					"namespace": "default",
					"annotations": map[string]any{
						utils.AnnoKeyFolder: "src-folder",
					},
				},
			},
		}
		mockClient.On("Get", mock.Anything, "rename-k8s-uid", metav1.GetOptions{}, mock.Anything).
			Return(grafanaObj, nil)
		mockClient.On("Delete", mock.Anything, "rename-k8s-uid", metav1.DeleteOptions{}, mock.Anything).
			Return(nil)

		repo.On("Read", mock.Anything, "new-path/k8s.json", "new-ref").
			Return(&repository.FileInfo{Data: data, Path: "new-path/k8s.json"}, nil)
		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(nil, fmt.Errorf("parse not implemented in test"))

		mgr := NewResourcesManager(repo, nil, mockParser, clients)
		_, _, _, err := mgr.RenameResourceFile(context.Background(), "old-path/k8s.json", "old-ref", "new-path/k8s.json", "new-ref")

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to write resource")
		require.NotContains(t, err.Error(), "file does not contain a valid resource",
			"remove step should have succeeded for the k8s resource")
	})
}
