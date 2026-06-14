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
	"k8s.io/apimachinery/pkg/util/sets"

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
	clients.On("SupportedResources").Return(SupportedProvisioningResources).Maybe()

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

func TestParser_FolderAnnotationGuard(t *testing.T) {
	// An org-scoped resource that is declared as supported but is NOT folder-scoped
	// (no CapabilityFolder). It must never receive a folder annotation.
	orgScopedGVK := schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v0alpha1", Kind: "Playlist"}
	orgScopedGVR := schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}

	supported := []SupportedResource{
		{GroupKind: dashboardV0.DashboardResourceInfo.GroupVersionKind().GroupKind(), Capabilities: sets.New(CapabilityFolder)},
		{GroupKind: orgScopedGVK.GroupKind(), Capabilities: sets.New[string]()},
	}

	clients := NewMockResourceClients(t)
	clients.On("ForKind", mock.Anything, dashboardV0.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()
	clients.On("ForKind", mock.Anything, orgScopedGVK).
		Return(nil, orgScopedGVR, nil).Maybe()
	clients.On("SupportedResources").Return(supported).Maybe()

	parser := &parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      provisioning.LocalRepositoryType,
			Namespace: "xxx",
			Name:      "repo",
		},
		clients: clients,
		config: &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Namespace: "xxx", Name: "repo"},
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		},
	}

	t.Run("folder-scoped resource still gets a folder annotation", func(t *testing.T) {
		parsed, err := parser.Parse(context.Background(), &repository.FileInfo{
			Path: "team-a/test-dashboard.json",
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, ParseFolder("team-a/", "repo").ID, parsed.Meta.GetFolder(),
			"dashboards must continue to get a folder annotation")
		require.Equal(t, ParseFolder("team-a/", "repo").ID, parsed.Obj.GetAnnotations()[utils.AnnoKeyFolder])
	})

	t.Run("org-scoped resource gets no folder annotation", func(t *testing.T) {
		parsed, err := parser.Parse(context.Background(), &repository.FileInfo{
			Path: "team-a/my-playlist.json",
			Data: []byte(`apiVersion: playlist.grafana.app/v0alpha1
kind: Playlist
metadata:
  name: my-playlist
spec:
  title: My playlist
`),
		})
		require.NoError(t, err)
		require.Empty(t, parsed.Meta.GetFolder(),
			"org-scoped resources must not have a folder annotation stamped on them")
		_, hasFolder := parsed.Obj.GetAnnotations()[utils.AnnoKeyFolder]
		require.False(t, hasFolder, "org-scoped resources must not carry the folder annotation")
	})
}

func TestParser_FolderMetadataRefFallback(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.On("ForKind", mock.Anything, mock.Anything).
		Return(nil, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()
	clients.On("SupportedResources").Return(SupportedProvisioningResources).Maybe()

	folderMetadataJSON := `{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"stable-uid"},"spec":{"title":"Team A"}}`

	dashboardYAML := `apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Test dashboard
`

	repoConfig := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Namespace: "xxx", Name: "repo"},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
		},
	}

	t.Run("reads folder metadata from target ref", func(t *testing.T) {
		reader := repository.NewMockReader(t)
		reader.On("Config").Return(repoConfig).Maybe()
		reader.On("Read", mock.Anything, "team-a/_folder.json", "feature-branch").
			Return(&repository.FileInfo{Data: []byte(folderMetadataJSON), Hash: "h1"}, nil)

		p := &parser{
			repo:                  provisioning.ResourceRepositoryInfo{Type: provisioning.GitHubRepositoryType, Namespace: "xxx", Name: "repo"},
			clients:               clients,
			config:                repoConfig,
			reader:                reader,
			folderMetadataEnabled: true,
		}

		parsed, err := p.Parse(context.Background(), &repository.FileInfo{
			Path: "team-a/dashboard.json",
			Ref:  "feature-branch",
			Data: []byte(dashboardYAML),
		})
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parsed.Meta.GetFolder())
	})

	t.Run("falls back to configured branch when target ref not found", func(t *testing.T) {
		reader := repository.NewMockReader(t)
		reader.On("Config").Return(repoConfig).Maybe()
		reader.On("Read", mock.Anything, "team-a/_folder.json", "new-pr-branch").
			Return(nil, fmt.Errorf("ref not found: refs/heads/new-pr-branch: %w", repository.ErrRefNotFound))
		reader.On("Read", mock.Anything, "team-a/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte(folderMetadataJSON), Hash: "h1"}, nil)

		p := &parser{
			repo:                  provisioning.ResourceRepositoryInfo{Type: provisioning.GitHubRepositoryType, Namespace: "xxx", Name: "repo"},
			clients:               clients,
			config:                repoConfig,
			reader:                reader,
			folderMetadataEnabled: true,
		}

		parsed, err := p.Parse(context.Background(), &repository.FileInfo{
			Path: "team-a/dashboard.json",
			Ref:  "new-pr-branch",
			Data: []byte(dashboardYAML),
		})
		require.NoError(t, err)
		require.Equal(t, "stable-uid", parsed.Meta.GetFolder(),
			"should use stable UID from configured branch when PR branch doesn't exist")
	})

	t.Run("falls back to hash-based ID when both refs lack metadata", func(t *testing.T) {
		reader := repository.NewMockReader(t)
		reader.On("Config").Return(repoConfig).Maybe()
		reader.On("Read", mock.Anything, "team-a/_folder.json", "new-pr-branch").
			Return(nil, fmt.Errorf("ref not found: refs/heads/new-pr-branch: %w", repository.ErrRefNotFound))
		reader.On("Read", mock.Anything, "team-a/_folder.json", "").
			Return(nil, repository.ErrFileNotFound)

		p := &parser{
			repo:                  provisioning.ResourceRepositoryInfo{Type: provisioning.GitHubRepositoryType, Namespace: "xxx", Name: "repo"},
			clients:               clients,
			config:                repoConfig,
			reader:                reader,
			folderMetadataEnabled: true,
		}

		parsed, err := p.Parse(context.Background(), &repository.FileInfo{
			Path: "team-a/dashboard.json",
			Ref:  "new-pr-branch",
			Data: []byte(dashboardYAML),
		})
		require.NoError(t, err)
		require.Equal(t, ParseFolder("team-a/", "repo").ID, parsed.Meta.GetFolder(),
			"should fall back to hash-based folder ID when no _folder.json on any branch")
	})

	t.Run("does not fall back for non-ref errors", func(t *testing.T) {
		reader := repository.NewMockReader(t)
		reader.On("Config").Return(repoConfig).Maybe()
		reader.On("Read", mock.Anything, "team-a/_folder.json", "feature-branch").
			Return(nil, repository.ErrFileNotFound)

		p := &parser{
			repo:                  provisioning.ResourceRepositoryInfo{Type: provisioning.GitHubRepositoryType, Namespace: "xxx", Name: "repo"},
			clients:               clients,
			config:                repoConfig,
			reader:                reader,
			folderMetadataEnabled: true,
		}

		parsed, err := p.Parse(context.Background(), &repository.FileInfo{
			Path: "team-a/dashboard.json",
			Ref:  "feature-branch",
			Data: []byte(dashboardYAML),
		})
		require.NoError(t, err)
		require.Equal(t, ParseFolder("team-a/", "repo").ID, parsed.Meta.GetFolder(),
			"should not retry on configured branch for non-ref errors like ErrFileNotFound")
		reader.AssertNotCalled(t, "Read", mock.Anything, "team-a/_folder.json", "")
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

func TestSkipsStrictValidation(t *testing.T) {
	// Behaviour must be identical to the previous hardcoded dashboard check
	// (f.GVR == DashboardResource): only the v1 dashboard GVR is exempt.
	require.True(t, skipsStrictValidation(DashboardResource),
		"v1 dashboard resource must be exempt from strict validation")
	require.False(t, skipsStrictValidation(FolderResource),
		"non-dashboard resources must use strict validation")
	// The exemption is version-specific: v2 dashboards keep strict validation so
	// their CUE schema is enforced by apiserver admission.
	require.False(t, skipsStrictValidation(DashboardResourceV2),
		"v2 dashboard resource must keep strict validation")
	require.False(t, skipsStrictValidation(DashboardResourceV2alpha1),
		"v2alpha1 dashboard resource must keep strict validation")
	require.False(t, skipsStrictValidation(DashboardResourceV2beta1),
		"v2beta1 dashboard resource must keep strict validation")
}

func TestParsedResource_DryRun_FieldValidation(t *testing.T) {
	notFound := apierrors.NewNotFound(schema.GroupResource{Resource: "test"}, "my-resource")

	tests := []struct {
		name                string
		gvr                 schema.GroupVersionResource
		skipStrict          bool
		wantFieldValidation string
	}{
		{
			name:                "v1 dashboard resource is exempt and uses Ignore",
			gvr:                 DashboardResource,
			wantFieldValidation: "Ignore",
		},
		{
			name:                "v2 dashboard resource is not exempt and uses Strict",
			gvr:                 DashboardResourceV2,
			wantFieldValidation: "Strict",
		},
		{
			name:                "non-dashboard resource uses Strict",
			gvr:                 FolderResource,
			wantFieldValidation: "Strict",
		},
		{
			name:                "SkipStrictValidation forces Ignore regardless of resource",
			gvr:                 FolderResource,
			skipStrict:          true,
			wantFieldValidation: "Ignore",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &MockDynamicResourceInterface{}
			// No existing resource, so DryRun takes the Create path.
			mockClient.On("Get", mock.Anything, "my-resource", metav1.GetOptions{}, mock.Anything).
				Return(nil, notFound)

			obj := &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
			}}
			mockClient.On("Create", mock.Anything, obj,
				mock.MatchedBy(func(opts metav1.CreateOptions) bool {
					return opts.FieldValidation == tt.wantFieldValidation
				}), mock.Anything).
				Return(obj, nil)

			parsed := &ParsedResource{
				Action:               provisioning.ResourceActionCreate,
				Obj:                  obj,
				GVR:                  tt.gvr,
				SkipStrictValidation: tt.skipStrict,
				Client:               mockClient,
				Repo:                 testRepoInfo(),
			}

			require.NoError(t, parsed.DryRun(context.Background()))
			mockClient.AssertExpectations(t)
		})
	}
}

func TestParsedResource_DryRun_CarriesResourceVersion(t *testing.T) {
	existing := managedGrafanaObj("my-resource", "default", nil)
	existing.SetResourceVersion("42")

	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "my-resource", "namespace": "default"},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)

	mockClient := &MockDynamicResourceInterface{}
	mockClient.On("Get", mock.Anything, "my-resource", metav1.GetOptions{}, mock.Anything).
		Return(existing, nil)
	mockClient.On("Update", mock.Anything, mock.MatchedBy(func(o *unstructured.Unstructured) bool {
		return o.GetResourceVersion() == "42"
	}), mock.Anything, mock.Anything).Return(obj, nil)

	parsed := &ParsedResource{
		Obj:    obj,
		Meta:   meta,
		GVR:    FolderResource,
		Client: mockClient,
		Repo:   testRepoInfo(),
	}

	require.NoError(t, parsed.DryRun(context.Background()))
	require.Equal(t, provisioning.ResourceActionUpdate, parsed.Action)
	mockClient.AssertExpectations(t)
}

func newParsedResource(client *MockDynamicResourceInterface, opts ...func(*ParsedResource)) *ParsedResource {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "dashboard.grafana.app/v1",
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": "my-dash", "namespace": "default"},
	}}
	meta, _ := utils.MetaAccessor(obj)
	p := &ParsedResource{
		Obj:    obj,
		Meta:   meta,
		Client: client,
		Repo:   testRepoInfo(),
		GVR:    DashboardResource,
	}
	for _, fn := range opts {
		fn(p)
	}
	return p
}

func withDryRun() func(*ParsedResource) {
	return func(p *ParsedResource) {
		p.DryRunResponse = &unstructured.Unstructured{}
	}
}

func withExisting(obj *unstructured.Unstructured) func(*ParsedResource) {
	return func(p *ParsedResource) {
		p.Existing = obj
	}
}

func withAction(action provisioning.ResourceAction) func(*ParsedResource) {
	return func(p *ParsedResource) {
		p.Action = action
	}
}

func TestParsedResource_Run(t *testing.T) {
	successObj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "my-dash", "namespace": "default"},
	}}
	badRequestErr := apierrors.NewBadRequest("uid too long, max 40 characters")
	forbiddenErr := apierrors.NewForbidden(schema.GroupResource{Resource: "dashboards"}, "my-dash", fmt.Errorf("quota reached"))
	alreadyExistsErr := apierrors.NewAlreadyExists(schema.GroupResource{Resource: "dashboards"}, "my-dash")
	notFoundErr := apierrors.NewNotFound(schema.GroupResource{Resource: "dashboards"}, "my-dash")
	internalErr := apierrors.NewInternalError(fmt.Errorf("something broke"))

	t.Run("nil client returns error", func(t *testing.T) {
		parsed := &ParsedResource{
			Obj: &unstructured.Unstructured{Object: map[string]any{
				"metadata": map[string]any{"name": "x", "namespace": "default"},
			}},
		}
		err := parsed.Run(t.Context())
		require.ErrorContains(t, err, "unable to find client")
	})

	// --- Create path (DryRun + no Existing) ---

	t.Run("create succeeds on first attempt", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(successObj, nil)

		parsed := newParsedResource(mc, withDryRun())
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.Equal(t, provisioning.ResourceActionCreate, parsed.Action)
		mc.AssertNumberOfCalls(t, "Create", 1)
		mc.AssertNotCalled(t, "Update")
	})

	t.Run("create validation error returns immediately without update", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, badRequestErr)

		parsed := newParsedResource(mc, withDryRun())
		err := parsed.Run(t.Context())

		require.True(t, apierrors.IsBadRequest(err))
		mc.AssertNumberOfCalls(t, "Create", 1)
		mc.AssertNotCalled(t, "Update")
	})

	t.Run("create forbidden error returns immediately without update", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, forbiddenErr)

		parsed := newParsedResource(mc, withDryRun())
		err := parsed.Run(t.Context())

		require.True(t, apierrors.IsForbidden(err))
		mc.AssertNotCalled(t, "Update")
	})

	t.Run("create internal error returns immediately without update", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, internalErr)

		parsed := newParsedResource(mc, withDryRun())
		err := parsed.Run(t.Context())

		require.True(t, apierrors.IsInternalError(err))
		mc.AssertNotCalled(t, "Update")
	})

	t.Run("create AlreadyExists falls through to update", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, alreadyExistsErr)
		// The fall-through fetches the existing resource to carry its
		// resourceVersion into the update.
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(existing, nil)
		mc.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(successObj, nil)

		parsed := newParsedResource(mc, withDryRun())
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.Equal(t, provisioning.ResourceActionUpdate, parsed.Action)
		mc.AssertNumberOfCalls(t, "Create", 1)
		mc.AssertNumberOfCalls(t, "Update", 1)
	})

	// --- Update path (no DryRun, fetches existing) ---

	t.Run("update succeeds when existing resource found", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(existing, nil)
		mc.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(successObj, nil)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.Equal(t, provisioning.ResourceActionUpdate, parsed.Action)
		mc.AssertNotCalled(t, "Create")
	})

	t.Run("update carries the existing resourceVersion", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		existing.SetResourceVersion("42")
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(existing, nil)
		mc.On("Update", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
			return obj.GetResourceVersion() == "42"
		}), mock.Anything, mock.Anything).Return(successObj, nil)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.Equal(t, provisioning.ResourceActionUpdate, parsed.Action)
		mc.AssertNumberOfCalls(t, "Update", 1)
	})

	t.Run("update validation error returns immediately without create fallback", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(existing, nil)
		mc.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, badRequestErr)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.True(t, apierrors.IsBadRequest(err))
		mc.AssertNotCalled(t, "Create")
	})

	t.Run("update NotFound falls through to create", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(nil, notFoundErr)
		mc.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, notFoundErr)
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(successObj, nil)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.Equal(t, provisioning.ResourceActionCreate, parsed.Action)
		mc.AssertNumberOfCalls(t, "Update", 1)
		mc.AssertNumberOfCalls(t, "Create", 1)
	})

	t.Run("update NotFound clears carried resourceVersion before create fallback", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		existing.SetResourceVersion("42")
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(existing, nil)
		mc.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, notFoundErr)
		mc.On("Create", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
			return obj.GetResourceVersion() == ""
		}), mock.Anything, mock.Anything).Return(successObj, nil)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.Equal(t, provisioning.ResourceActionCreate, parsed.Action)
		mc.AssertNumberOfCalls(t, "Create", 1)
	})

	t.Run("update NotFound then create also fails returns create error", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(nil, notFoundErr)
		mc.On("Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, notFoundErr)
		mc.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil, forbiddenErr)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.True(t, apierrors.IsForbidden(err))
	})

	// --- Delete path ---

	t.Run("delete succeeds", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Delete", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(nil)

		parsed := newParsedResource(mc, withAction(provisioning.ResourceActionDelete), withDryRun(), withExisting(existing))
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		require.NotNil(t, parsed.Upsert)
	})

	t.Run("delete without dry run fetches existing first", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(existing, nil)
		mc.On("Delete", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(nil)

		parsed := newParsedResource(mc, withAction(provisioning.ResourceActionDelete))
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		mc.AssertNumberOfCalls(t, "Get", 1)
	})

	t.Run("delete resource not found returns nil", func(t *testing.T) {
		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(nil, notFoundErr)

		parsed := newParsedResource(mc, withAction(provisioning.ResourceActionDelete))
		err := parsed.Run(t.Context())

		require.NoError(t, err)
		mc.AssertNotCalled(t, "Delete")
	})

	t.Run("delete already deleted returns nil", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Delete", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(notFoundErr)

		parsed := newParsedResource(mc, withAction(provisioning.ResourceActionDelete), withDryRun(), withExisting(existing))
		err := parsed.Run(t.Context())

		require.NoError(t, err)
	})

	t.Run("delete other error returns error", func(t *testing.T) {
		existing := managedGrafanaObj("my-dash", "default", nil)
		mc := &MockDynamicResourceInterface{}
		mc.On("Delete", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(internalErr)

		parsed := newParsedResource(mc, withAction(provisioning.ResourceActionDelete), withDryRun(), withExisting(existing))
		err := parsed.Run(t.Context())

		require.True(t, apierrors.IsInternalError(err))
	})

	// --- Ownership checks ---

	t.Run("ownership conflict on upsert returns error", func(t *testing.T) {
		otherOwner := managedGrafanaObj("my-dash", "default", nil)
		otherMeta, _ := utils.MetaAccessor(otherOwner)
		otherMeta.SetManagerProperties(utils.ManagerProperties{
			Kind:     utils.ManagerKindRepo,
			Identity: "other-repo",
		})

		mc := &MockDynamicResourceInterface{}
		mc.On("Get", mock.Anything, "my-dash", mock.Anything, mock.Anything).Return(otherOwner, nil)

		parsed := newParsedResource(mc)
		err := parsed.Run(t.Context())

		require.Error(t, err)
		mc.AssertNotCalled(t, "Create")
		mc.AssertNotCalled(t, "Update")
	})
}
