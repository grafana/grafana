package install

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func TestPluginInstall_ShouldUpdate(t *testing.T) {
	baseExisting := &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "org-1",
			Name:      "plugin-1",
			Annotations: map[string]string{
				PluginInstallSourceAnnotation: string(SourcePluginStore),
			},
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:      "plugin-1",
			Version: "1.0.0",
			Class:   pluginsv0alpha1.PluginSpecClass(ClassExternal),
		},
	}

	baseInstall := PluginInstall{
		ID:      "plugin-1",
		Version: "1.0.0",
		Class:   ClassExternal,
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
			name: "class differs",
			modifyInstall: func(pi *PluginInstall) {
				pi.Class = ClassCore
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
				existing.Annotations[PluginInstallSourceAnnotation] = string(SourceUnknown)
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
	}{
		{
			name: "creates plugin when not found",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Class:   ClassExternal,
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
				Class:   ClassExternal,
				Source:  SourcePluginStore,
			},
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       "org-1",
					Name:            "plugin-1",
					ResourceVersion: "7",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: string(SourcePluginStore),
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "plugin-1",
					Version: "1.0.0",
					Class:   pluginsv0alpha1.PluginSpecClass(ClassExternal),
				},
			},
			expectedUpdates: 1,
		},
		{
			name: "skips create when plugin matches",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Class:   ClassExternal,
				Source:  SourcePluginStore,
			},
			existing: &pluginsv0alpha1.Plugin{
				ObjectMeta: metav1.ObjectMeta{
					Namespace:       "org-1",
					Name:            "plugin-1",
					ResourceVersion: "9",
					Annotations: map[string]string{
						PluginInstallSourceAnnotation: string(SourcePluginStore),
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "plugin-1",
					Version: "1.0.0",
					Class:   pluginsv0alpha1.PluginSpecClass(ClassExternal),
				},
			},
		},
		{
			name: "returns error on unexpected get failure",
			install: &PluginInstall{
				ID:      "plugin-err",
				Version: "1.0.0",
				Class:   ClassExternal,
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

			registrar := NewInstallRegistrar(&fakeClientGenerator{client: fakeClient})

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
				Class:   ClassExternal,
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
				Class:   ClassExternal,
				Source:  SourcePluginStore,
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.NotNil(t, p.Spec.Url)
				require.Equal(t, "https://example.com/plugin.zip", *p.Spec.Url)
			},
		},
		{
			name: "core class is mapped correctly",
			install: PluginInstall{
				ID:      "plugin-core",
				Version: "2.0.0",
				Class:   ClassCore,
				Source:  SourcePluginStore,
			},
			namespace: "org-2",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, pluginsv0alpha1.PluginSpecClass(ClassCore), p.Spec.Class)
			},
		},
		{
			name: "cdn class is mapped correctly",
			install: PluginInstall{
				ID:      "plugin-cdn",
				Version: "3.0.0",
				Class:   ClassCDN,
				Source:  SourcePluginStore,
			},
			namespace: "org-3",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, pluginsv0alpha1.PluginSpecClass(ClassCDN), p.Spec.Class)
			},
		},
		{
			name: "source annotation is set correctly",
			install: PluginInstall{
				ID:      "plugin-1",
				Version: "1.0.0",
				Class:   ClassExternal,
				Source:  SourceUnknown,
			},
			namespace: "org-1",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, string(SourceUnknown), p.Annotations[PluginInstallSourceAnnotation])
			},
		},
		{
			name: "namespace and name are set correctly",
			install: PluginInstall{
				ID:      "my-plugin",
				Version: "1.0.0",
				Class:   ClassExternal,
				Source:  SourcePluginStore,
			},
			namespace: "my-namespace",
			validate: func(t *testing.T, p *pluginsv0alpha1.Plugin) {
				require.Equal(t, "my-namespace", p.Namespace)
				require.Equal(t, "my-plugin", p.Name)
				require.Equal(t, "my-plugin", p.Spec.Id)
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
				Class:   ClassExternal,
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
				Class:   ClassExternal,
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
				Class:   ClassExternal,
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
				Class:   ClassExternal,
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
						PluginInstallSourceAnnotation: string(SourcePluginStore),
					},
				},
				Spec: pluginsv0alpha1.PluginSpec{
					Id:      "plugin-1",
					Version: "1.0.0",
					Url:     tt.existingURL,
					Class:   pluginsv0alpha1.PluginSpecClass(ClassExternal),
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
		registrar := NewInstallRegistrar(generator)

		client, err := registrar.GetClient()
		require.NoError(t, err)
		require.NotNil(t, client)
	})

	t.Run("returns same client on subsequent calls", func(t *testing.T) {
		fakeClient := &fakePluginInstallClient{}
		generator := &fakeClientGenerator{client: fakeClient}
		registrar := NewInstallRegistrar(generator)

		client1, err1 := registrar.GetClient()
		require.NoError(t, err1)

		client2, err2 := registrar.GetClient()
		require.NoError(t, err2)

		require.Equal(t, client1, client2)
	})

	t.Run("returns error when client generation fails", func(t *testing.T) {
		generator := &fakeClientGenerator{client: nil, shouldError: true}
		registrar := NewInstallRegistrar(generator)

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
				Class:   ClassExternal,
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
			name: "update fails",
			install: &PluginInstall{
				ID:      "plugin-1",
				Version: "2.0.0",
				Class:   ClassExternal,
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
								PluginInstallSourceAnnotation: string(SourcePluginStore),
							},
						},
						Spec: pluginsv0alpha1.PluginSpec{
							Id:      "plugin-1",
							Version: "1.0.0",
							Class:   pluginsv0alpha1.PluginSpecClass(ClassExternal),
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

			registrar := NewInstallRegistrar(&fakeClientGenerator{client: fakeClient})

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
		name          string
		namespace     string
		pluginName    string
		source        Source
		existing      *pluginsv0alpha1.Plugin
		existingErr   error
		expectedCalls int
		expectError   bool
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
						PluginInstallSourceAnnotation: string(SourcePluginStore),
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
						PluginInstallSourceAnnotation: string(SourceUnknown),
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
						PluginInstallSourceAnnotation: string(SourcePluginStore),
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			deleteCalls := 0

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
			}

			registrar := NewInstallRegistrar(&fakeClientGenerator{client: fakeClient})

			err := registrar.Unregister(ctx, tt.namespace, tt.pluginName, tt.source)

			require.Equal(t, tt.expectedCalls, deleteCalls)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestInstallRegistrar_GetClientError(t *testing.T) {
	t.Run("Register returns error with nil client", func(t *testing.T) {
		ctx := context.Background()
		generator := &fakeClientGenerator{client: nil, shouldError: true}
		registrar := NewInstallRegistrar(generator)

		install := &PluginInstall{
			ID:      "plugin-1",
			Version: "1.0.0",
			Class:   ClassExternal,
			Source:  SourcePluginStore,
		}

		err := registrar.Register(ctx, "org-1", install)
		require.Error(t, err)
	})

	t.Run("Unregister returns error with nil client", func(t *testing.T) {
		ctx := context.Background()
		generator := &fakeClientGenerator{client: nil, shouldError: true}
		registrar := NewInstallRegistrar(generator)

		err := registrar.Unregister(ctx, "org-1", "plugin-1", SourcePluginStore)
		require.Error(t, err)
	})
}
