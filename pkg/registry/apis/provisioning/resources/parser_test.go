package resources

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestParser(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.On("ForKind", mock.Anything, dashboardV0.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()
	clients.On("ForKind", mock.Anything, dashboardV1.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV1.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()

	parser := &parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      provisioning.LocalRepositoryType,
			Namespace: "xxx",
			Name:      "repo",
		},
		clients: clients,
		config: &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "xxx",
				Name:      "repo",
			},
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		},
	}

	t.Run("invalid input", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte("hello"), // not a real resource
		})
		require.Error(t, err)
		// Check that it's a ResourceValidationError
		var resourceErr *ResourceValidationError
		require.ErrorAs(t, err, &resourceErr, "error should be a ResourceValidationError")
		require.Contains(t, err.Error(), "resource validation failed")
	})

	t.Run("dashboard parsing (with and without name)", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-v0
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "test-v0", dash.Obj.GetName())
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)

		// Now try again without a name
		_, err = parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: ` + dashboardV1.APIVERSION + `
kind: Dashboard
spec:
  title: Test dashboard
`),
		})
		require.EqualError(t, err, "resource validation failed: name.metadata.name: Required value: missing name in resource")
	})

	t.Run("generate name will generate a name", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  generateName: rand-
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.True(t, strings.HasPrefix(dash.Obj.GetName(), "rand-"), "set name")
	})

	t.Run("dashboard classic format", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`{ "uid": "test", "schemaVersion": 30, "panels": [], "tags": [] }`),
		})
		require.NoError(t, err)
		require.Equal(t, "test", dash.Obj.GetName())
		require.Equal(t, provisioning.ClassicDashboard, dash.Classic)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)
	})

	t.Run("validate proper folder metadata is set", func(t *testing.T) {
		testCases := []struct {
			name           string
			filePath       string
			expectedFolder string
		}{
			{
				name:           "file in subdirectory should use parsed folder ID",
				filePath:       "team-a/testing-valid-dashboard.json",
				expectedFolder: ParseFolder("team-a/", "repo").ID,
			},
			{
				name:           "file in first-level directory should use parent folder id",
				filePath:       "testing-valid-dashboard.json",
				expectedFolder: parser.repo.Name,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				dash, err := parser.Parse(context.Background(), &repository.FileInfo{
					Path: tc.filePath,
					Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Test dashboard
`),
				})
				require.NoError(t, err)
				require.Equal(t, tc.expectedFolder, dash.Meta.GetFolder(), "folder should match expected")
				annotations := dash.Obj.GetAnnotations()
				require.NotNil(t, annotations, "annotations should not be nil")
				require.Equal(t, tc.expectedFolder, annotations["grafana.app/folder"], "folder annotation should match expected")
			})
		}
	})
}

func TestSameIdentity(t *testing.T) {
	makeParsed := func(name, group, kind string) *ParsedResource {
		return &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": name},
			}},
			GVK: schema.GroupVersionKind{Group: group, Kind: kind},
		}
	}

	t.Run("true when name, group, and kind match", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		b := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		require.True(t, a.SameIdentity(b))
	})

	t.Run("false when name differs", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		b := makeParsed("dash-2", "dashboard.grafana.app", "Dashboard")
		require.False(t, a.SameIdentity(b))
	})

	t.Run("false when group differs", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		b := makeParsed("dash-1", "folder.grafana.app", "Dashboard")
		require.False(t, a.SameIdentity(b))
	})

	t.Run("false when kind differs", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		b := makeParsed("dash-1", "dashboard.grafana.app", "Folder")
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

	t.Run("is symmetric", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		b := makeParsed("dash-2", "dashboard.grafana.app", "Dashboard")
		require.Equal(t, a.SameIdentity(b), b.SameIdentity(a))
	})

	t.Run("false when receiver is nil", func(t *testing.T) {
		var a *ParsedResource
		b := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		require.False(t, a.SameIdentity(b))
	})

	t.Run("false when other is nil", func(t *testing.T) {
		a := makeParsed("dash-1", "dashboard.grafana.app", "Dashboard")
		require.False(t, a.SameIdentity(nil))
	})

	t.Run("false when both are nil", func(t *testing.T) {
		var a *ParsedResource
		require.False(t, a.SameIdentity(nil))
	})
}

func TestExistingFolder(t *testing.T) {
	t.Run("returns empty when Existing is nil", func(t *testing.T) {
		parsed := &ParsedResource{}
		require.Equal(t, "", parsed.ExistingFolder())
	})

	t.Run("returns empty when Existing has no folder annotation", func(t *testing.T) {
		parsed := &ParsedResource{
			Existing: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "test"},
			}},
		}
		require.Equal(t, "", parsed.ExistingFolder())
	})

	t.Run("returns folder annotation value", func(t *testing.T) {
		parsed := &ParsedResource{
			Existing: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
					"annotations": map[string]any{
						utils.AnnoKeyFolder: "my-folder",
					},
				},
			}},
		}
		require.Equal(t, "my-folder", parsed.ExistingFolder())
	})

	t.Run("returns empty when annotations map is empty", func(t *testing.T) {
		parsed := &ParsedResource{
			Existing: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{
					"name":        "test",
					"annotations": map[string]any{},
				},
			}},
		}
		require.Equal(t, "", parsed.ExistingFolder())
	})
}

func TestDryRunDeletePopulatesExisting(t *testing.T) {
	t.Run("populates Existing when resource is found", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		grafanaObj := managedGrafanaObj("my-resource", "default", nil)
		mockClient.On("Get", mock.Anything, "my-resource", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)

		parsed := &ParsedResource{
			Action: provisioning.ResourceActionDelete,
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}},
			Client: mockClient,
			Repo:   testRepoInfo(),
		}

		require.NoError(t, parsed.DryRun(context.Background()))
		require.NotNil(t, parsed.Existing)
		require.Equal(t, "my-resource", parsed.Existing.GetName())
	})

	t.Run("does not mutate the resource", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		grafanaObj := managedGrafanaObj("my-resource", "default", nil)
		mockClient.On("Get", mock.Anything, "my-resource", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)

		parsed := &ParsedResource{
			Action: provisioning.ResourceActionDelete,
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}},
			Client: mockClient,
			Repo:   testRepoInfo(),
		}

		require.NoError(t, parsed.DryRun(context.Background()))
		require.Nil(t, parsed.Upsert, "Upsert must remain nil for a dry run")
		mockClient.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		mockClient.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		mockClient.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("NotFound leaves Existing nil without error", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		mockClient.On("Get", mock.Anything, "missing", metav1.GetOptions{}, mock.Anything).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, "missing"))

		parsed := &ParsedResource{
			Action: provisioning.ResourceActionDelete,
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "missing", "namespace": "default"},
			}},
			Client: mockClient,
			Repo:   testRepoInfo(),
		}

		require.NoError(t, parsed.DryRun(context.Background()))
		require.Nil(t, parsed.Existing)
	})

	t.Run("non-NotFound error is propagated", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		mockClient.On("Get", mock.Anything, "broken", metav1.GetOptions{}, mock.Anything).
			Return(nil, fmt.Errorf("connection refused"))

		parsed := &ParsedResource{
			Action: provisioning.ResourceActionDelete,
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "broken", "namespace": "default"},
			}},
			Client: mockClient,
			Repo:   testRepoInfo(),
		}

		err := parsed.DryRun(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to get existing resource for delete dry run")
		require.Contains(t, err.Error(), "connection refused")
		require.Nil(t, parsed.Existing)
	})

	t.Run("returns error when Client is nil", func(t *testing.T) {
		parsed := &ParsedResource{
			Action: provisioning.ResourceActionDelete,
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "test", "namespace": "default"},
			}},
		}

		err := parsed.DryRun(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "no client configured")
	})

	t.Run("ExistingFolder works after DryRun populates Existing", func(t *testing.T) {
		mockClient := &MockDynamicResourceInterface{}
		grafanaObj := managedGrafanaObj("my-resource", "default", map[string]any{
			utils.AnnoKeyFolder: "team-a",
		})
		mockClient.On("Get", mock.Anything, "my-resource", metav1.GetOptions{}, mock.Anything).Return(grafanaObj, nil)

		parsed := &ParsedResource{
			Action: provisioning.ResourceActionDelete,
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}},
			Client: mockClient,
			Repo:   testRepoInfo(),
		}

		require.NoError(t, parsed.DryRun(context.Background()))
		require.Equal(t, "team-a", parsed.ExistingFolder())
	})
}
