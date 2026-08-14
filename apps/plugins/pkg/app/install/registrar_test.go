package install

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

func TestPluginInstall_ShouldUpdate(t *testing.T) {
	baseExisting := &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "plugin-1",
			Annotations: map[string]string{
				PluginInstallSourceAnnotation: SourcePluginStore,
			},
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      "plugin-1",
			Version: "1.0.0",
		},
	}

	baseInstall := PluginInstall{
		ID:      "plugin-1",
		Version: "1.0.0",
		Source:  SourcePluginStore,
	}

	tests := []struct {
		name           string
		modifyInstall  func(*PluginInstall)
		modifyExisting func(*pluginsv0alpha1.Plugin)
		expectUpdate   bool
	}{
		{
			name:         "no changes",
			expectUpdate: false,
		},
		{
			name: "version differs",
			modifyInstall: func(pi *PluginInstall) {
				pi.Version = "2.0.0"
			},
			expectUpdate: true,
		},
		{
			name: "url differs",
			modifyInstall: func(pi *PluginInstall) {
				pi.URL = "https://example.com/plugin.zip"
			},
			expectUpdate: true,
		},
		{
			name: "source differs",
			modifyExisting: func(existing *pluginsv0alpha1.Plugin) {
				existing.Annotations[PluginInstallSourceAnnotation] = SourceUnknown
			},
			expectUpdate: true,
		},
		{
			name: "dependencies not yet applied",
			modifyInstall: func(pi *PluginInstall) {
				pi.Dependencies = []string{"dependency-panel"}
			},
			expectUpdate: true,
		},
		{
			name: "dependencies match applied annotation",
			modifyInstall: func(pi *PluginInstall) {
				pi.Dependencies = []string{"dependency-panel", "other-panel"}
			},
			modifyExisting: func(existing *pluginsv0alpha1.Plugin) {
				existing.Annotations[AppliedDependenciesAnnotation] = "other-panel,dependency-panel"
			},
			expectUpdate: false,
		},
		{
			name: "stale applied dependencies",
			modifyExisting: func(existing *pluginsv0alpha1.Plugin) {
				existing.Annotations[AppliedDependenciesAnnotation] = "dependency-panel"
			},
			expectUpdate: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			existing := baseExisting.DeepCopy()
			install := baseInstall

			if tt.modifyExisting != nil {
				tt.modifyExisting(existing)
			}
			if tt.modifyInstall != nil {
				tt.modifyInstall(&install)
			}

			require.Equal(t, tt.expectUpdate, install.ShouldUpdate(existing))
		})
	}
}

func TestInstallRegistrar_Register(t *testing.T) {
	tests := []struct {
		name            string
		install         *PluginInstall
		existing        *pluginsv0alpha1.Plugin
		existingErr     error
		expectedCreates int
		expectedUpdates int
		expectError     bool
		validateUpdate  func(*testing.T, *pluginsv0alpha1.Plugin)
	}{
		{
			name: "creates plugin when not found",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			existingErr:     errorsK8s.NewNotFound(pluginGroupResource(), "plugin-1"),
			expectedCreates: 1,
		},
		{
			name: "updates plugin when fields change",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "2.0.0",
				Source:  SourcePluginStore,
			},
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       "org-1",
					Name:            "plugin-1",
					ResourceVersion: "7",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourcePluginStore,
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "plugin-1",
					Version: "1.0.0",
				},
			},
			expectedUpdates: 1,
		},
		{
			name: "updates plugin while preserving existing metadata",
			install: &PluginInstall{
				ID:      "dependency-panel",
				Version: "2.0.0",
				Source:  SourcePluginStore,
			},
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       "org-1",
					Name:            "dependency-panel",
					ResourceVersion: "8",
					Labels: map[string]string{
						"plugins.grafana.app/dependency": "true",
					},
					Annotations: map[string]string{
						PluginInstallSourceAnnotation:              SourceDependencyPlugin,
						"plugins.grafana.app/dependency-parents":   "parent-app",
						"plugins.grafana.app/applied-dependencies": "nested-panel",
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "dependency-panel",
					Version: "latest",
				},
			},
			expectedUpdates: 1,
			validateUpdate: func(t *testing.T, updated *pluginsv0alpha1.Plugin) {
				require.Equal(t, "true", updated.Labels["plugins.grafana.app/dependency"])
				require.Equal(t, "parent-app", updated.Annotations["plugins.grafana.app/dependency-parents"])
				require.Equal(t, "nested-panel", updated.Annotations["plugins.grafana.app/applied-dependencies"])
				require.Equal(t, SourcePluginStore, updated.Annotations[PluginInstallSourceAnnotation])
			},
		},
		{
			name: "skips create when plugin matches",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       "org-1",
					Name:            "plugin-1",
					ResourceVersion: "9",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourcePluginStore,
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "plugin-1",
					Version: "1.0.0",
				},
			},
		},
		{
			name: "returns error on unexpected get failure",
			install: &PluginInstall{
				ID:      "plugin-err",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			existingErr: errorsK8s.NewInternalError(errors.New("boom")),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			createCalls := 0
			updateCalls := 0
			var receivedResourceVersions []string
			var updatedPlugins []*pluginsv0alpha1.Plugin

			fakeClient := &fakePluginInstallClient{
				getFunc: func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					if tt.existingErr != nil {
						return nil, tt.existingErr
					}
					if tt.existing == nil {
						return nil, errorsK8s.NewNotFound(pluginGroupResource(), "plugin-1")
					}
					return tt.existing.DeepCopy(), nil
				},
				createFunc: func(context.Context, *pluginsv0alpha1.Plugin, resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					createCalls++
					return tt.install.ToPluginInstallV0Alpha1("org-1"), nil
				},
				updateFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
					updateCalls++
					receivedResourceVersions = append(receivedResourceVersions, opts.ResourceVersion)
					updatedPlugins = append(updatedPlugins, obj)
					return obj, nil
				},
			}

			registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

			err := registrar.Register(ctx, "org-1", tt.install)
			if tt.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expectedCreates, createCalls)
			require.Equal(t, tt.expectedUpdates, updateCalls)

			if tt.expectedUpdates > 0 {
				require.Equal(t, []string{tt.existing.ResourceVersion}, receivedResourceVersions)
				require.Len(t, updatedPlugins, 1)
				require.Equal(t, tt.install.Version, updatedPlugins[0].Spec.Version)
				if tt.validateUpdate != nil {
					tt.validateUpdate(t, updatedPlugins[0])
				}
			}
		})
	}
}

func pluginGroupResource() schema.GroupResource {
	return schema.GroupResource{Group: pluginsv0alpha1.APIGroup, Resource: "plugininstalls"}
}

type fakePluginInstallClient struct {
	listAllFunc func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error)
	getFunc     func(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error)
	createFunc  func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error)
	updateFunc  func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error)
	deleteFunc  func(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error
}

func (f *fakePluginInstallClient) Get(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, identifier)
	}
	return nil, errorsK8s.NewNotFound(pluginGroupResource(), identifier.Name)
}

func (f *fakePluginInstallClient) ListAll(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
	if f.listAllFunc != nil {
		return f.listAllFunc(ctx, namespace, opts)
	}
	return &pluginsv0alpha1.PluginList{}, nil
}

func (f *fakePluginInstallClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
	return f.ListAll(ctx, namespace, opts)
}

func (f *fakePluginInstallClient) Create(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
	if f.createFunc != nil {
		return f.createFunc(ctx, obj, opts)
	}
	return obj, nil
}

func (f *fakePluginInstallClient) Update(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, obj, opts)
	}
	return obj, nil
}

func (f *fakePluginInstallClient) UpdateStatus(ctx context.Context, identifier resource.Identifier, newStatus pluginsv0alpha1.PluginStatus, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
	return nil, nil
}

func (f *fakePluginInstallClient) Patch(ctx context.Context, identifier resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions) (*pluginsv0alpha1.Plugin, error) {
	return nil, nil
}

func (f *fakePluginInstallClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, identifier, opts)
	}
	return nil
}

type fakeClientGenerator struct {
	client      *fakePluginInstallClient
	shouldError bool
}

func (f *fakeClientGenerator) ClientFor(resource.Kind) (resource.Client, error) {
	if f.shouldError {
		return nil, errors.New("client generation failed")
	}
	return &fakeResourceClient{client: f.client}, nil
}

func (f *fakeClientGenerator) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}

func (f *fakeClientGenerator) DiscoveryClient() (resource.DiscoveryClient, error) {
	return nil, nil
}

type fakeResourceClient struct {
	client *fakePluginInstallClient
}

func (f *fakeResourceClient) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	return f.client.Get(ctx, identifier)
}

func (f *fakeResourceClient) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	obj, err := f.client.Get(ctx, identifier)
	if err != nil {
		return err
	}
	if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
		*target = *obj
	}
	return nil
}

func (f *fakeResourceClient) List(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
	return f.client.ListAll(ctx, namespace, options)
}

func (f *fakeResourceClient) ListInto(ctx context.Context, namespace string, options resource.ListOptions, into resource.ListObject) error {
	list, err := f.client.ListAll(ctx, namespace, options)
	if err != nil {
		return err
	}
	if target, ok := into.(*pluginsv0alpha1.PluginList); ok {
		*target = *list
	}
	return nil
}

func (f *fakeResourceClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin)
	return f.client.Create(ctx, plugin, options)
}

func (f *fakeResourceClient) CreateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions, into resource.Object) error {
	created, err := f.Create(ctx, identifier, obj, options)
	if err != nil {
		return err
	}
	if plugin, ok := created.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
	return nil
}

func (f *fakeResourceClient) Update(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.UpdateOptions) (resource.Object, error) {
	plugin := obj.(*pluginsv0alpha1.Plugin)
	return f.client.Update(ctx, plugin, options)
}

func (f *fakeResourceClient) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.UpdateOptions, into resource.Object) error {
	updated, err := f.Update(ctx, identifier, obj, options)
	if err != nil {
		return err
	}
	if plugin, ok := updated.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
	return nil
}

func (f *fakeResourceClient) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions) (resource.Object, error) {
	return nil, nil
}

func (f *fakeResourceClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
	return nil
}

func (f *fakeResourceClient) Delete(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
	return f.client.Delete(ctx, identifier, options)
}

func (f *fakeResourceClient) SubresourceRequest(ctx context.Context, identifier resource.Identifier, req resource.CustomRouteRequestOptions) ([]byte, error) {
	return []byte{}, nil
}

func (f *fakeResourceClient) Watch(ctx context.Context, namespace string, options resource.WatchOptions) (resource.WatchResponse, error) {
	return &fakeWatchResponse{}, nil
}

type fakeWatchResponse struct{}

func (f *fakeWatchResponse) Stop() {}

func (f *fakeWatchResponse) WatchEvents() <-chan resource.WatchEvent {
	ch := make(chan resource.WatchEvent)
	close(ch)
	return ch
}

func TestPluginInstall_ToPluginInstallV0Alpha1(t *testing.T) {
	tests := []struct {
		name      string
		install   PluginInstall
		namespace string
		validate  func(*testing.T, *pluginsv0alpha1.Plugin)
	}{
		{
			name: "empty URL creates nil pointer",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Nil(t, p.Spec.Url)
			},
		},
		{
			name: "non-empty URL creates pointer",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				URL:     "https://example.com/plugin.zip",
				Source:  SourcePluginStore,
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.NotNil(t, p.Spec.Url)
				require.Equal(t, "https://example.com/plugin.zip", *p.Spec.Url)
			},
		},
		{
			name: "source annotation is set correctly",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourceUnknown,
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, SourceUnknown, p.Annotations[PluginInstallSourceAnnotation])
			},
		},
		{
			name: "namespace and name are set correctly",
			install: PluginInstall{
				ID:      "my-plugin",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			namespace: "my-namespace",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, "my-namespace", p.Namespace)
				require.Equal(t, "my-plugin", p.Name)
				require.Equal(t, "my-plugin", p.Spec.Id)
			},
		},
		{
			name: "dependencies are stamped as applied-dependencies annotation",
			install: PluginInstall{
				ID:           "plugin-1",
				Version:      "1.0.0",
				Source:       SourcePluginStore,
				Dependencies: []string{"dependency-panel", "other-panel"},
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, "dependency-panel,other-panel", p.Annotations[AppliedDependenciesAnnotation])
			},
		},
		{
			name: "no dependencies leaves applied-dependencies annotation unset",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.NotContains(t, p.Annotations, AppliedDependenciesAnnotation)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.install.ToPluginInstallV0Alpha1(tt.namespace)
			require.NotNil(t, result)
			require.Equal(t, tt.namespace, result.Namespace)
			require.Equal(t, tt.install.ID, result.Name)
			require.Equal(t, tt.install.ID, result.Spec.Id)
			require.Equal(t, tt.install.Version, result.Spec.Version)
			tt.validate(t, result)
		})
	}
}

func TestEqualStringPointers(t *testing.T) {
	str1 := "value1"
	str2 := "value2"
	str3 := "value1"

	tests := []struct {
		name     string
		a        *string
		b        *string
		expected bool
	}{
		{
			name:     "both nil",
			a:        nil,
			b:        nil,
			expected: true,
		},
		{
			name:     "first nil, second non-nil",
			a:        nil,
			b:        &str1,
			expected: false,
		},
		{
			name:     "first non-nil, second nil",
			a:        &str1,
			b:        nil,
			expected: false,
		},
		{
			name:     "both non-nil with same value",
			a:        &str1,
			b:        &str3,
			expected: true,
		},
		{
			name:     "both non-nil with different values",
			a:        &str1,
			b:        &str2,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := equalStringPointers(tt.a, tt.b)
			require.Equal(t, tt.expected, result)
		})
	}
}

func TestPluginInstall_ShouldUpdate_URLTransitions(t *testing.T) {
	existingURL := "https://old.example.com/plugin.zip"
	newURL := "https://new.example.com/plugin.zip"

	tests := []struct {
		name         string
		install      PluginInstall
		existingURL  *string
		expectUpdate bool
	}{
		{
			name: "URL transition from nil to non-nil",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				URL:     newURL,
				Source:  SourcePluginStore,
			},
			existingURL:  nil,
			expectUpdate: true,
		},
		{
			name: "URL transition from non-nil to nil",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				URL:     "",
				Source:  SourcePluginStore,
			},
			existingURL:  &existingURL,
			expectUpdate: true,
		},
		{
			name: "URL stays nil",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				URL:     "",
				Source:  SourcePluginStore,
			},
			existingURL:  nil,
			expectUpdate: false,
		},
		{
			name: "URL stays same non-nil value",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				URL:     existingURL,
				Source:  SourcePluginStore,
			},
			existingURL:  &existingURL,
			expectUpdate: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			existing := &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
					Name:      "plugin-1",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourcePluginStore,
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "plugin-1",
					Version: "1.0.0",
					Url:     tt.existingURL,
				},
			}

			require.Equal(t, tt.expectUpdate, tt.install.ShouldUpdate(existing))
		})
	}
}

func TestInstallRegistrar_GetClient(t *testing.T) {
	t.Run("successfully creates client on first call", func(t *testing.T) {
		fakeClient := &fakePluginInstallClient{}
		generator := &fakeClientGenerator{client: fakeClient}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, generator)

		client, err := registrar.GetClient()
		require.NoError(t, err)
		require.NotNil(t, client)
	})

	t.Run("returns same client on subsequent calls", func(t *testing.T) {
		fakeClient := &fakePluginInstallClient{}
		generator := &fakeClientGenerator{client: fakeClient}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, generator)

		client1, err1 := registrar.GetClient()
		require.NoError(t, err1)

		client2, err2 := registrar.GetClient()
		require.NoError(t, err2)

		require.Equal(t, client1, client2)
	})

	t.Run("returns error when client generation fails", func(t *testing.T) {
		generator := &fakeClientGenerator{client: nil, shouldError: true}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, generator)

		client, err := registrar.GetClient()
		require.Error(t, err)
		require.Nil(t, client)
	})
}

func TestInstallRegistrar_Register_ErrorCases(t *testing.T) {
	tests := []struct {
		name        string
		install     *PluginInstall
		setupClient func(*fakePluginInstallClient)
		expectError bool
	}{
		{
			name: "create fails",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			setupClient: func(fc *fakePluginInstallClient) {
				fc.getFunc = func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					return nil, errorsK8s.NewNotFound(pluginGroupResource(), "plugin-1")
				}
				fc.createFunc = func(context.Context, *pluginsv0alpha1.Plugin, resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					return nil, errors.New("create failed")
				}
			},
			expectError: true,
		},
		{
			name: "treats AlreadyExists as conflict (concurrent create race)",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Source:  SourcePluginStore,
			},
			setupClient: func(fc *fakePluginInstallClient) {
				fc.getFunc = func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					return nil, errorsK8s.NewNotFound(pluginGroupResource(), "plugin-1")
				}
				fc.createFunc = func(context.Context, *pluginsv0alpha1.Plugin, resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					return nil, errorsK8s.NewAlreadyExists(pluginGroupResource(), "plugin-1")
				}
			},
			expectError: false,
		},
		{
			name: "update fails",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "2.0.0",
				Source:  SourcePluginStore,
			},
			setupClient: func(fc *fakePluginInstallClient) {
				fc.getFunc = func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					return &pluginsv0alpha1.Plugin{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:       "org-1",
							Name:            "plugin-1",
							ResourceVersion: "5",
							Annotations: map[string]string{
								PluginInstallSourceAnnotation: SourcePluginStore,
							},
						},
						Spec: pluginsv0alpha1.PluginSpec{
							Id:      "plugin-1",
							Version: "1.0.0",
						},
					}, nil
				}
				fc.updateFunc = func(context.Context, *pluginsv0alpha1.Plugin, resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
					return nil, errors.New("update failed")
				}
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			fakeClient := &fakePluginInstallClient{}
			tt.setupClient(fakeClient)

			registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

			err := registrar.Register(ctx, "org-1", tt.install)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestInstallRegistrar_Unregister(t *testing.T) {
	tests := []struct {
		name            string
		namespace       string
		pluginName      string
		source          Source
		existing        *pluginsv0alpha1.Plugin
		existingErr     error
		expectedCalls   int
		expectedUpdates int
		expectError     bool
		validateUpdate  func(*testing.T, *pluginsv0alpha1.Plugin)
	}{
		{
			name:       "successfully deletes plugin with matching source",
			namespace:  "org-1",
			pluginName: "plugin-1",
			source:     SourcePluginStore,
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
					Name:      "plugin-1",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourcePluginStore,
					},
				},
			},
			expectedCalls: 1,
		},
		{
			name:          "plugin not found should not error",
			namespace:     "org-1",
			pluginName:    "plugin-nonexistent",
			source:        SourcePluginStore,
			existingErr:   errorsK8s.NewNotFound(pluginGroupResource(), "plugin-nonexistent"),
			expectedCalls: 0,
			expectError:   false,
		},
		{
			name:       "skips delete when source doesn't match",
			namespace:  "org-1",
			pluginName: "plugin-1",
			source:     SourcePluginStore,
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
					Name:      "plugin-1",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourceUnknown,
					},
				},
			},
			expectedCalls: 0,
		},
		{
			name:          "returns error on unexpected get failure",
			namespace:     "org-1",
			pluginName:    "plugin-err",
			source:        SourcePluginStore,
			existingErr:   errorsK8s.NewInternalError(errors.New("get failed")),
			expectedCalls: 0,
			expectError:   true,
		},
		{
			name:       "delete failure returns error",
			namespace:  "org-1",
			pluginName: "plugin-1",
			source:     SourcePluginStore,
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
					Name:      "plugin-1",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourcePluginStore,
					},
				},
			},
			expectedCalls: 1,
			expectError:   true,
		},
		{
			name:       "handles missing source annotation",
			namespace:  "org-1",
			pluginName: "plugin-1",
			source:     SourcePluginStore,
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "org-1",
					Name:        "plugin-1",
					Annotations: map[string]string{},
				},
			},
			expectedCalls: 1,
		},
		{
			name:       "demotes plugin with dependency parents instead of deleting",
			namespace:  "org-1",
			pluginName: "dependency-panel",
			source:     SourcePluginStore,
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       "org-1",
					Name:            "dependency-panel",
					ResourceVersion: "12",
					Labels: map[string]string{
						"plugins.grafana.app/dependency": "true",
					},
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourcePluginStore,
						DependencyParentsAnnotation:   "parent-app",
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "dependency-panel",
					Version: "2.0.0",
				},
			},
			expectedCalls:   0,
			expectedUpdates: 1,
			validateUpdate: func(t *testing.T, updated *pluginsv0alpha1.Plugin) {
				require.Equal(t, SourceDependencyPlugin, updated.Annotations[PluginInstallSourceAnnotation])
				require.Equal(t, DependencyPluginVersion, updated.Spec.Version)
				require.Equal(t, "parent-app", updated.Annotations[DependencyParentsAnnotation])
				require.Equal(t, "true", updated.Labels["plugins.grafana.app/dependency"])
			},
		},
		{
			name:       "skips demote when plugin is already a dependency install",
			namespace:  "org-1",
			pluginName: "dependency-panel",
			source:     SourceDependencyPlugin,
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "org-1",
					Name:      "dependency-panel",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: SourceDependencyPlugin,
						DependencyParentsAnnotation:   "parent-app",
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "dependency-panel",
					Version: DependencyPluginVersion,
				},
			},
			expectedCalls:   0,
			expectedUpdates: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			deleteCalls := 0
			updateCalls := 0
			var updatedPlugins []*pluginsv0alpha1.Plugin

			fakeClient := &fakePluginInstallClient{
				getFunc: func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					if tt.existingErr != nil {
						return nil, tt.existingErr
					}
					if tt.existing == nil {
						return nil, errorsK8s.NewNotFound(pluginGroupResource(), tt.pluginName)
					}
					return tt.existing.DeepCopy(), nil
				},
				deleteFunc: func(context.Context, resource.Identifier, resource.DeleteOptions) error {
					deleteCalls++
					if tt.name == "delete failure returns error" {
						return errors.New("delete failed")
					}
					return nil
				},
				updateFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
					updateCalls++
					updatedPlugins = append(updatedPlugins, obj)
					return obj, nil
				},
			}

			registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

			err := registrar.Unregister(ctx, tt.namespace, tt.pluginName, tt.source)

			require.Equal(t, tt.expectedCalls, deleteCalls)
			require.Equal(t, tt.expectedUpdates, updateCalls)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			if tt.validateUpdate != nil {
				require.Len(t, updatedPlugins, 1)
				tt.validateUpdate(t, updatedPlugins[0])
			}
		})
	}
}

func TestInstallRegistrar_SyncNamespace(t *testing.T) {
	newRecord := func(name, id, version, source string) pluginsv0alpha1.Plugin {
		return pluginsv0alpha1.Plugin{
			ObjectMeta: metav1.ObjectMeta{
				Namespace:       "org-1",
				Name:            name,
				ResourceVersion: "5",
				Annotations: map[string]string{
					PluginInstallSourceAnnotation: source,
				},
			},
			Spec: pluginsv0alpha1.PluginSpec{
				Id:      id,
				Version: version,
			},
		}
	}

	type counters struct {
		lists, creates, updates, deletes int
		gets                             []string
	}

	// newListsClient serves the given lists in order (repeating the last) and
	// serves Get from the most recently listed snapshot.
	newListsClient := func(c *counters, lists ...[]pluginsv0alpha1.Plugin) *fakePluginInstallClient {
		return &fakePluginInstallClient{
			listAllFunc: func(context.Context, string, resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
				items := lists[min(c.lists, len(lists)-1)]
				c.lists++
				return &pluginsv0alpha1.PluginList{Items: items}, nil
			},
			getFunc: func(_ context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
				c.gets = append(c.gets, identifier.Name)
				items := lists[min(c.lists, len(lists))-1]
				for i := range items {
					if items[i].Name == identifier.Name {
						return items[i].DeepCopy(), nil
					}
				}
				return nil, errorsK8s.NewNotFound(pluginGroupResource(), identifier.Name)
			},
			createFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
				c.creates++
				return obj, nil
			},
			updateFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
				c.updates++
				return obj, nil
			},
			deleteFunc: func(context.Context, resource.Identifier, resource.DeleteOptions) error {
				c.deletes++
				return nil
			},
		}
	}

	t.Run("an in-sync namespace needs only the list", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c, []pluginsv0alpha1.Plugin{
			newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
			newRecord("plugin-2", "plugin-2", "2.0.0", SourcePluginStore),
			newRecord("child-plugin", "child-plugin", "1.0.0", SourceChildPlugin),
			newRecord("dependency-panel", "dependency-panel", DependencyPluginVersion, SourceDependencyPlugin),
		})
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		registerSkips := testutil.ToFloat64(metrics.RegistrationOperationsTotal.WithLabelValues("register", "skipped"))
		unregisterSkips := testutil.ToFloat64(metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "skipped"))

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
			{ID: "plugin-2", Version: "2.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, 1, c.lists)
		require.Empty(t, c.gets)
		require.Zero(t, c.creates+c.updates+c.deletes)
		require.Equal(t, float64(2), testutil.ToFloat64(metrics.RegistrationOperationsTotal.WithLabelValues("register", "skipped"))-registerSkips)
		require.Equal(t, float64(2), testutil.ToFloat64(metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "skipped"))-unregisterSkips)
	})

	t.Run("re-lists after a write and keeps still-valid skips", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-gone", "plugin-gone", "1.0.0", SourcePluginStore),
				newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
				newRecord("plugin-2", "plugin-2", "2.0.0", SourcePluginStore),
			},
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
				newRecord("plugin-2", "plugin-2", "2.0.0", SourcePluginStore),
			},
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		registerSkips := testutil.ToFloat64(metrics.RegistrationOperationsTotal.WithLabelValues("register", "skipped"))

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
			{ID: "plugin-2", Version: "2.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-gone"}, c.gets)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.deletes)
		require.Zero(t, c.creates+c.updates)
		// skips are counted on the first pass only
		require.Equal(t, float64(2), testutil.ToFloat64(metrics.RegistrationOperationsTotal.WithLabelValues("register", "skipped"))-registerSkips)
	})

	t.Run("re-registers a skipped plugin the hooks rewrote", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-1", "plugin-1", "0.9.0", SourcePluginStore),
				newRecord("plugin-2", "plugin-2", "2.0.0", SourcePluginStore),
			},
			// the write to plugin-1 cascaded and rewrote plugin-2
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
				newRecord("plugin-2", "plugin-2", "0.1.0", SourcePluginStore),
			},
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
				newRecord("plugin-2", "plugin-2", "2.0.0", SourcePluginStore),
			},
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
			{ID: "plugin-2", Version: "2.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-1", "plugin-2"}, c.gets)
		require.Equal(t, 3, c.lists)
		require.Equal(t, 2, c.updates)
	})

	t.Run("re-unregisters a skipped record the hooks rewrote", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-gone", "plugin-gone", "1.0.0", SourcePluginStore),
				newRecord("child-plugin", "child-plugin", "1.0.0", SourceChildPlugin),
			},
			// deleting plugin-gone cascaded and reassigned child-plugin's source
			[]pluginsv0alpha1.Plugin{
				newRecord("child-plugin", "child-plugin", "1.0.0", SourcePluginStore),
			},
			nil,
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-gone", "child-plugin"}, c.gets)
		require.Equal(t, 3, c.lists)
		require.Equal(t, 2, c.deletes)
	})

	t.Run("converges when a later pass's write cascades again", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-gone", "plugin-gone", "1.0.0", SourcePluginStore),
				newRecord("child-plugin", "child-plugin", "1.0.0", SourceChildPlugin),
				newRecord("panel-b", "panel-b", "1.0.0", SourcePluginStore),
			},
			// deleting plugin-gone flipped child-plugin's source
			[]pluginsv0alpha1.Plugin{
				newRecord("child-plugin", "child-plugin", "1.0.0", SourcePluginStore),
				newRecord("panel-b", "panel-b", "1.0.0", SourcePluginStore),
			},
			// deleting child-plugin cascaded and deleted desired panel-b
			nil,
			[]pluginsv0alpha1.Plugin{
				newRecord("panel-b", "panel-b", "1.0.0", SourcePluginStore),
			},
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "panel-b", Version: "1.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-gone", "child-plugin", "panel-b"}, c.gets)
		require.Equal(t, 4, c.lists)
		require.Equal(t, 2, c.deletes)
		require.Equal(t, 1, c.creates)
	})

	t.Run("errors after the pass limit when the namespace never settles", func(t *testing.T) {
		c := &counters{}
		// the record reappears in every list, so every pass deletes it again
		fakeClient := newListsClient(c, []pluginsv0alpha1.Plugin{
			newRecord("plugin-gone", "plugin-gone", "1.0.0", SourcePluginStore),
		})
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.ErrorContains(t, err, "did not converge")
		require.ErrorContains(t, err, "plugin-gone")
		require.Equal(t, maxSyncNamespacePasses, c.lists)
		require.Equal(t, maxSyncNamespacePasses, c.deletes)
	})

	t.Run("demotes an unregistered record that other plugins depend on", func(t *testing.T) {
		withParents := newRecord("dep-panel", "dep-panel", "1.0.0", SourcePluginStore)
		withParents.Annotations[DependencyParentsAnnotation] = "parent-app"
		demoted := newRecord("dep-panel", "dep-panel", DependencyPluginVersion, SourceDependencyPlugin)
		demoted.Annotations[DependencyParentsAnnotation] = "parent-app"
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{withParents},
			[]pluginsv0alpha1.Plugin{demoted},
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"dep-panel"}, c.gets)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.updates)
		require.Zero(t, c.deletes)
	})

	t.Run("a record with a matching id but a different name is not a cache hit", func(t *testing.T) {
		alias := newRecord("alias", "plugin-1", "1.0.0", SourcePluginStore)
		created := newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore)
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{alias},
			[]pluginsv0alpha1.Plugin{alias, created},
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-1"}, c.gets)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.creates)
	})

	t.Run("re-lists after a concurrent update conflict", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{newRecord("plugin-1", "plugin-1", "0.9.0", SourcePluginStore)},
			[]pluginsv0alpha1.Plugin{newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore)},
		)
		fakeClient.updateFunc = func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
			c.updates++
			return nil, errorsK8s.NewConflict(pluginGroupResource(), obj.Name, errors.New("resource version mismatch"))
		}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.updates)
	})

	t.Run("ignores records with an empty id", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c, []pluginsv0alpha1.Plugin{{
			ObjectMeta: metav1.ObjectMeta{Namespace: "org-1", Name: "weird-record"},
			Spec:       pluginsv0alpha1.PluginSpec{Version: "1.0.0"},
		}})
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.NoError(t, err)
		require.Equal(t, 1, c.lists)
		require.Empty(t, c.gets)
	})

	t.Run("re-lists after a concurrent create conflict", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			nil,
			// another writer created the record between the list and the read
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
			},
		)
		fakeClient.createFunc = func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
			c.creates++
			return nil, errorsK8s.NewAlreadyExists(pluginGroupResource(), obj.Name)
		}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.creates)
	})

	t.Run("re-reads and updates when the listed record differs", func(t *testing.T) {
		listed := newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore)
		fresh := listed.DeepCopy()
		fresh.ResourceVersion = "6"
		updated := newRecord("plugin-1", "plugin-1", "2.0.0", SourcePluginStore)
		getCalls, listCalls := 0, 0
		var updateResourceVersions []string
		fakeClient := &fakePluginInstallClient{
			listAllFunc: func(context.Context, string, resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
				listCalls++
				if listCalls == 1 {
					return &pluginsv0alpha1.PluginList{Items: []pluginsv0alpha1.Plugin{listed}}, nil
				}
				return &pluginsv0alpha1.PluginList{Items: []pluginsv0alpha1.Plugin{updated}}, nil
			},
			getFunc: func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
				getCalls++
				return fresh.DeepCopy(), nil
			},
			updateFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, opts resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
				updateResourceVersions = append(updateResourceVersions, opts.ResourceVersion)
				return obj, nil
			},
		}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "2.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, 1, getCalls)
		require.Equal(t, 2, listCalls)
		require.Equal(t, []string{"6"}, updateResourceVersions)
	})

	t.Run("the fresh read wins when the record changed after the list", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c, []pluginsv0alpha1.Plugin{
			newRecord("plugin-1", "plugin-1", "0.9.0", SourcePluginStore),
		})
		// the record was updated between the list and the read
		fakeClient.getFunc = func(_ context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
			c.gets = append(c.gets, identifier.Name)
			fresh := newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore)
			return &fresh, nil
		}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-1"}, c.gets)
		require.Equal(t, 1, c.lists)
		require.Zero(t, c.updates)
	})

	t.Run("creates when no record is listed", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			nil,
			[]pluginsv0alpha1.Plugin{
				newRecord("plugin-1", "plugin-1", "1.0.0", SourcePluginStore),
			},
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, []PluginInstall{
			{ID: "plugin-1", Version: "1.0.0", Source: SourcePluginStore},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-1"}, c.gets)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.creates)
	})

	t.Run("re-reads before unregistering when the record name differs from its id", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c, []pluginsv0alpha1.Plugin{
			newRecord("alias", "plugin-x", "1.0.0", SourceChildPlugin),
		})
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.NoError(t, err)
		// Unregister reads by the id, finds nothing, and writes nothing
		require.Equal(t, []string{"plugin-x"}, c.gets)
		require.Equal(t, 1, c.lists)
		require.Zero(t, c.deletes)
	})

	t.Run("re-reads before unregistering when the record has no source annotation", func(t *testing.T) {
		c := &counters{}
		fakeClient := newListsClient(c,
			[]pluginsv0alpha1.Plugin{{
				ObjectMeta: metav1.ObjectMeta{Namespace: "org-1", Name: "plugin-1"},
				Spec:       pluginsv0alpha1.PluginSpec{Id: "plugin-1", Version: "1.0.0"},
			}},
			nil,
		)
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"plugin-1"}, c.gets)
		require.Equal(t, 2, c.lists)
		require.Equal(t, 1, c.deletes)
	})

	t.Run("returns the list error", func(t *testing.T) {
		fakeClient := &fakePluginInstallClient{
			listAllFunc: func(context.Context, string, resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
				return nil, errorsK8s.NewInternalError(errors.New("list failed"))
			},
		}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

		err := registrar.SyncNamespace(context.Background(), "org-1", SourcePluginStore, nil)
		require.Error(t, err)
	})
}

// TestInstallRegistrar_UnregisterIsNoOpImpliesNoWrite pins the SyncNamespace
// skip invariant: a record unregisterIsNoOp accepts must produce zero writes.
func TestInstallRegistrar_UnregisterIsNoOpImpliesNoWrite(t *testing.T) {
	records := []*pluginsv0alpha1.Plugin{
		{
			ObjectMeta: metav1.ObjectMeta{
				Namespace:   "org-1",
				Name:        "plugin-1",
				Annotations: map[string]string{PluginInstallSourceAnnotation: SourceChildPlugin},
			},
			Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-1", Version: "1.0.0"},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Namespace:   "org-1",
				Name:        "plugin-2",
				Annotations: map[string]string{PluginInstallSourceAnnotation: SourceDependencyPlugin},
			},
			Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-2", Version: DependencyPluginVersion},
		},
		// a foreign-source record with dependency parents must not be demoted:
		// the source check runs before the demote inside Unregister
		{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "org-1",
				Name:      "plugin-3",
				Annotations: map[string]string{
					PluginInstallSourceAnnotation: SourceChildPlugin,
					DependencyParentsAnnotation:   "parent-app",
				},
			},
			Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-3", Version: "1.0.0"},
		},
	}

	for _, record := range records {
		t.Run(record.Name, func(t *testing.T) {
			writes := 0
			fakeClient := &fakePluginInstallClient{
				getFunc: func(context.Context, resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					return record.DeepCopy(), nil
				},
				createFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					writes++
					return obj, nil
				},
				updateFunc: func(_ context.Context, obj *pluginsv0alpha1.Plugin, _ resource.UpdateOptions) (*pluginsv0alpha1.Plugin, error) {
					writes++
					return obj, nil
				},
				deleteFunc: func(context.Context, resource.Identifier, resource.DeleteOptions) error {
					writes++
					return nil
				},
			}
			registrar := NewInstallRegistrar(&logging.NoOpLogger{}, &fakeClientGenerator{client: fakeClient})

			require.True(t, registrar.unregisterIsNoOp(record, SourcePluginStore))
			require.NoError(t, registrar.Unregister(context.Background(), "org-1", record.Spec.Id, SourcePluginStore))
			require.Zero(t, writes)
		})
	}
}

func TestInstallRegistrar_GetClientError(t *testing.T) {
	t.Run("Register returns error with nil client", func(t *testing.T) {
		ctx := context.Background()
		generator := &fakeClientGenerator{client: nil, shouldError: true}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, generator)

		install := &PluginInstall{
			ID:      "plugin-1",
			Version: "1.0.0",
			Source:  SourcePluginStore,
		}

		err := registrar.Register(ctx, "org-1", install)
		require.Error(t, err)
	})

	t.Run("Unregister returns error with nil client", func(t *testing.T) {
		ctx := context.Background()
		generator := &fakeClientGenerator{client: nil, shouldError: true}
		registrar := NewInstallRegistrar(&logging.NoOpLogger{}, generator)

		err := registrar.Unregister(ctx, "org-1", "plugin-1", SourcePluginStore)
		require.Error(t, err)
	})
}
