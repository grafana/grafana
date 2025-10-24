package installsync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
)

// Test helpers to avoid import cycles
type fakeServerLock struct {
	lockFunc func(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func (f *fakeServerLock) LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
	if f.lockFunc != nil {
		return f.lockFunc(ctx, actionName, maxInterval, fn)
	}
	fn(ctx)
	return nil
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
	// Return a proper k8s NotFound error
	return nil, errorsK8s.NewNotFound(schema.GroupResource{
		Group:    pluginsv0alpha1.APIGroup,
		Resource: "plugininstalls",
	}, identifier.Name)
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
	client *fakePluginInstallClient
}

func (f *fakeClientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
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
	// Copy the object data into the provided 'into' object
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
	// Copy the list data into the provided 'into' object
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
	// Copy the created object data into the provided 'into' object
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
	// Copy the updated object data into the provided 'into' object
	if plugin, ok := updated.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
	return nil
}

func (f *fakeResourceClient) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions) (resource.Object, error) {
	return f.client.Patch(ctx, identifier, patch, options)
}

func (f *fakeResourceClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
	patched, err := f.Patch(ctx, identifier, patch, options)
	if err != nil {
		return err
	}
	// Copy the patched object data into the provided 'into' object
	if plugin, ok := patched.(*pluginsv0alpha1.Plugin); ok {
		if target, ok := into.(*pluginsv0alpha1.Plugin); ok {
			*target = *plugin
		}
	}
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

func TestSyncer_Sync(t *testing.T) {
	tests := []struct {
		name                 string
		featureToggleEnabled bool
		orgs                 []*org.OrgDTO
		orgServiceError      error
		serverLockError      error
		expectedError        error
		expectSyncCalls      int
	}{
		{
			name:                 "feature toggle disabled",
			featureToggleEnabled: false,
			orgs:                 []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			expectedError:        nil,
			expectSyncCalls:      0,
		},
		{
			name:                 "feature toggle enabled, no orgs",
			featureToggleEnabled: true,
			orgs:                 []*org.OrgDTO{},
			expectedError:        nil,
			expectSyncCalls:      0,
		},
		{
			name:                 "feature toggle enabled, single org",
			featureToggleEnabled: true,
			orgs:                 []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			expectedError:        nil,
			expectSyncCalls:      1,
		},
		{
			name:                 "feature toggle enabled, multiple orgs",
			featureToggleEnabled: true,
			orgs: []*org.OrgDTO{
				{ID: 1, Name: "Org 1"},
				{ID: 2, Name: "Org 2"},
				{ID: 3, Name: "Org 3"},
			},
			expectedError:   nil,
			expectSyncCalls: 3,
		},
		{
			name:                 "org service error",
			featureToggleEnabled: true,
			orgs:                 nil,
			orgServiceError:      errors.New("org service error"),
			expectedError:        errors.New("org service error"),
			expectSyncCalls:      0,
		},
		{
			name:                 "server lock error",
			featureToggleEnabled: true,
			orgs:                 []*org.OrgDTO{{ID: 1, Name: "Org 1"}},
			serverLockError:      errors.New("lock error"),
			expectedError:        errors.New("lock error"),
			expectSyncCalls:      0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Setup feature toggles
			ft := featuremgmt.NewMockFeatureToggles(t)
			ft.EXPECT().IsEnabled(ctx, featuremgmt.FlagPluginInstallAPISync).Return(tt.featureToggleEnabled).Maybe()

			// Setup org service
			orgService := orgtest.NewOrgServiceFake()
			orgService.ExpectedOrgs = tt.orgs
			orgService.ExpectedError = tt.orgServiceError

			// Setup server lock
			serverLock := &fakeServerLock{}
			if tt.serverLockError != nil {
				serverLock.lockFunc = func(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error {
					return tt.serverLockError
				}
			}

			// Setup fake client and registrar
			syncCalls := 0
			fakeClient := &fakePluginInstallClient{
				createFunc: func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					syncCalls++
					return obj, nil
				},
				listAllFunc: func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
					return &pluginsv0alpha1.PluginList{}, nil
				},
			}
			clientGen := &fakeClientGenerator{client: fakeClient}
			registrar := install.NewInstallRegistrar(clientGen)

			// Create syncer
			s := newSyncer(
				ft,
				clientGen,
				registrar,
				orgService,
				func(orgID int64) string { return "org-1" },
				serverLock,
			)

			// Execute
			installedPlugins := []*plugins.Plugin{
				{JSONData: plugins.JSONData{ID: "test-plugin", Info: plugins.Info{Version: "1.0.0"}}},
			}
			err := s.Sync(ctx, install.SourcePluginStore, installedPlugins)

			// Verify
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectSyncCalls, syncCalls)
		})
	}
}

func TestSyncer_syncNamespace(t *testing.T) {
	tests := []struct {
		name               string
		installedPlugins   []*plugins.Plugin
		apiPlugins         []pluginsv0alpha1.Plugin
		clientListError    error
		expectedError      error
		expectedRegCalls   int
		expectedUnregCalls int
		registeredIDs      []string
		unregisteredIDs    []string
	}{
		{
			name:               "no installed plugins, no API plugins",
			installedPlugins:   []*plugins.Plugin{},
			apiPlugins:         []pluginsv0alpha1.Plugin{},
			expectedError:      nil,
			expectedRegCalls:   0,
			expectedUnregCalls: 0,
		},
		{
			name: "installed plugins only",
			installedPlugins: []*plugins.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin-1", Info: plugins.Info{Version: "1.0.0"}}, Class: plugins.ClassCore},
				{JSONData: plugins.JSONData{ID: "plugin-2", Info: plugins.Info{Version: "2.0.0"}}, Class: plugins.ClassExternal},
			},
			apiPlugins:         []pluginsv0alpha1.Plugin{},
			expectedError:      nil,
			expectedRegCalls:   2,
			expectedUnregCalls: 0,
			registeredIDs:      []string{"plugin-1", "plugin-2"},
		},
		{
			name:             "API plugins only",
			installedPlugins: []*plugins.Plugin{},
			apiPlugins: []pluginsv0alpha1.Plugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-1",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-1"},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-2",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-2"},
				},
			},
			expectedError:      nil,
			expectedRegCalls:   0,
			expectedUnregCalls: 2,
			unregisteredIDs:    []string{"plugin-1", "plugin-2"},
		},
		{
			name: "mixed - some match",
			installedPlugins: []*plugins.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin-1", Info: plugins.Info{Version: "1.0.0"}}, Class: plugins.ClassCore},
				{JSONData: plugins.JSONData{ID: "plugin-2", Info: plugins.Info{Version: "2.0.0"}}, Class: plugins.ClassExternal},
				{JSONData: plugins.JSONData{ID: "plugin-3", Info: plugins.Info{Version: "3.0.0"}}, Class: plugins.ClassExternal},
			},
			apiPlugins: []pluginsv0alpha1.Plugin{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-2",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-2", Version: "2.0.0"},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name: "plugin-4",
						Annotations: map[string]string{
							install.PluginInstallSourceAnnotation: install.SourcePluginStore,
						},
					},
					Spec: pluginsv0alpha1.PluginSpec{Id: "plugin-4"},
				},
			},
			expectedError:      nil,
			expectedRegCalls:   2, // plugin-1 and plugin-3 are new, plugin-2 already exists
			expectedUnregCalls: 1, // plugin-4 removed
			registeredIDs:      []string{"plugin-1", "plugin-3"},
			unregisteredIDs:    []string{"plugin-4"},
		},
		{
			name:             "list error",
			installedPlugins: []*plugins.Plugin{},
			apiPlugins:       []pluginsv0alpha1.Plugin{},
			clientListError:  errors.New("list error"),
			expectedError:    errors.New("list error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Track calls
			var registeredIDs []string
			var unregisteredIDs []string

			// Setup fake client
			fakeClient := &fakePluginInstallClient{
				listAllFunc: func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
					if tt.clientListError != nil {
						return nil, tt.clientListError
					}
					return &pluginsv0alpha1.PluginList{
						Items: tt.apiPlugins,
					}, nil
				},
				createFunc: func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					registeredIDs = append(registeredIDs, obj.Spec.Id)
					return obj, nil
				},
				deleteFunc: func(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
					unregisteredIDs = append(unregisteredIDs, identifier.Name)
					return nil
				},
				getFunc: func(ctx context.Context, identifier resource.Identifier) (*pluginsv0alpha1.Plugin, error) {
					// Check if plugin exists in apiPlugins
					for i := range tt.apiPlugins {
						if tt.apiPlugins[i].Name == identifier.Name {
							return &tt.apiPlugins[i], nil
						}
					}
					return nil, errorsK8s.NewNotFound(schema.GroupResource{
						Group:    pluginsv0alpha1.APIGroup,
						Resource: "plugininstalls",
					}, identifier.Name)
				},
			}

			clientGen := &fakeClientGenerator{client: fakeClient}
			registrar := install.NewInstallRegistrar(clientGen)

			// Create syncer
			s := newSyncer(
				featuremgmt.NewMockFeatureToggles(t),
				clientGen,
				registrar,
				orgtest.NewOrgServiceFake(),
				func(orgID int64) string { return "org-1" },
				&fakeServerLock{},
			)

			// Execute
			err := s.syncNamespace(ctx, "org-1", install.SourcePluginStore, tt.installedPlugins)

			// Verify
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError.Error())
			} else {
				require.NoError(t, err)
			}

			if tt.expectedRegCalls > 0 {
				require.Len(t, registeredIDs, tt.expectedRegCalls)
				if tt.registeredIDs != nil {
					require.ElementsMatch(t, tt.registeredIDs, registeredIDs)
				}
			}

			if tt.expectedUnregCalls > 0 {
				require.Len(t, unregisteredIDs, tt.expectedUnregCalls)
				if tt.unregisteredIDs != nil {
					require.ElementsMatch(t, tt.unregisteredIDs, unregisteredIDs)
				}
			}
		})
	}
}

func TestSyncer_getClient(t *testing.T) {
	tests := []struct {
		name string
	}{
		{
			name: "first call success and subsequent calls return cached client",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeClient := &fakePluginInstallClient{}
			clientGen := &fakeClientGenerator{client: fakeClient}

			s := newSyncer(
				featuremgmt.NewMockFeatureToggles(t),
				clientGen,
				install.NewInstallRegistrar(clientGen),
				orgtest.NewOrgServiceFake(),
				func(orgID int64) string { return "org-1" },
				&fakeServerLock{},
			)

			// First call
			client1, err1 := s.installRegistrar.GetClient()
			require.NoError(t, err1)
			require.NotNil(t, client1)

			// Second call should return cached client
			client2, err2 := s.installRegistrar.GetClient()
			require.NoError(t, err2)
			require.NotNil(t, client2)
			// Both calls should return the same client instance
			require.Equal(t, client1, client2)
		})
	}
}

func TestSyncer_syncAllNamespaces(t *testing.T) {
	tests := []struct {
		name            string
		orgs            []*org.OrgDTO
		orgServiceError error
		expectedError   error
		expectedCalls   int
	}{
		{
			name:          "no orgs",
			orgs:          []*org.OrgDTO{},
			expectedError: nil,
			expectedCalls: 0,
		},
		{
			name: "single org",
			orgs: []*org.OrgDTO{
				{ID: 1, Name: "Org 1"},
			},
			expectedError: nil,
			expectedCalls: 1,
		},
		{
			name: "multiple orgs",
			orgs: []*org.OrgDTO{
				{ID: 1, Name: "Org 1"},
				{ID: 2, Name: "Org 2"},
				{ID: 3, Name: "Org 3"},
			},
			expectedError: nil,
			expectedCalls: 3,
		},
		{
			name:            "org service error",
			orgs:            nil,
			orgServiceError: errors.New("org service error"),
			expectedError:   errors.New("org service error"),
			expectedCalls:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			orgService := orgtest.NewOrgServiceFake()
			orgService.ExpectedOrgs = tt.orgs
			orgService.ExpectedError = tt.orgServiceError

			// Track namespace sync calls
			syncCalls := 0
			fakeClient := &fakePluginInstallClient{
				createFunc: func(ctx context.Context, obj *pluginsv0alpha1.Plugin, opts resource.CreateOptions) (*pluginsv0alpha1.Plugin, error) {
					syncCalls++
					return obj, nil
				},
				listAllFunc: func(ctx context.Context, namespace string, opts resource.ListOptions) (*pluginsv0alpha1.PluginList, error) {
					return &pluginsv0alpha1.PluginList{}, nil
				},
			}

			clientGen := &fakeClientGenerator{client: fakeClient}

			s := newSyncer(
				featuremgmt.NewMockFeatureToggles(t),
				clientGen,
				install.NewInstallRegistrar(clientGen),
				orgService,
				func(orgID int64) string { return "org-1" },
				&fakeServerLock{},
			)

			installedPlugins := []*plugins.Plugin{
				{JSONData: plugins.JSONData{ID: "test-plugin", Info: plugins.Info{Version: "1.0.0"}}, Class: plugins.ClassCore},
			}

			err := s.syncAllNamespaces(ctx, install.SourcePluginStore, installedPlugins)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tt.expectedCalls, syncCalls)
		})
	}
}
