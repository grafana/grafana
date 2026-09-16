package appinstaller

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	apistore "github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func TestRegisterAuthorizers(t *testing.T) {
	tests := []struct {
		name              string
		appInstallers     []appsdkapiserver.AppInstaller
		expectedRegisters int
		expectedPanic     bool
	}{
		{
			name:              "empty installers list",
			appInstallers:     []appsdkapiserver.AppInstaller{},
			expectedRegisters: 0,
		},
		{
			name: "installer without authorizer provider",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstaller{
					groupVersions: []schema.GroupVersion{
						{Group: "test.example.com", Version: "v1"},
					},
				},
			},
			expectedPanic: true,
		},
		{
			name: "single installer with authorizer provider",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
			},
			expectedRegisters: 1,
		},
		{
			name: "single installer with invalid authorizer provider",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: nil,
				},
			},
			expectedPanic: true,
		},
		{
			name: "installer with multiple group versions",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
							{Group: "test.example.com", Version: "v2"},
							{Group: "other.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
			},
			expectedRegisters: 3,
		},
		{
			name: "multiple installers with authorizer support",
			appInstallers: []appsdkapiserver.AppInstaller{
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "test.example.com", Version: "v1"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
				&mockAppInstallerWithAuth{
					mockAppInstaller: &mockAppInstaller{
						groupVersions: []schema.GroupVersion{
							{Group: "another.example.com", Version: "v1"},
							{Group: "another.example.com", Version: "v2"},
						},
					},
					mockAuthorizer: &mockAuthorizer{},
				},
			},
			expectedRegisters: 3, // 1 from first installer + 2 from second installer
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			registrar := &mockAuthorizerRegistrar{}
			if tt.expectedPanic {
				defer func() {
					if r := recover(); r == nil {
						t.Errorf("%s case did not panic as expected", t.Name())
					}
				}()
			}
			RegisterAuthorizers(ctx, tt.appInstallers, registrar)
			require.Equal(t, tt.expectedRegisters, len(registrar.registrations))
		})
	}
}

type mockAppInstaller struct {
	appsdkapiserver.AppInstaller // Embed the interface
	groupVersions                []schema.GroupVersion
}

func (m *mockAppInstaller) GroupVersions() []schema.GroupVersion {
	return m.groupVersions
}

type mockAppInstallerWithAuth struct {
	*mockAppInstaller
	mockAuthorizer authorizer.Authorizer
}

func (m *mockAppInstallerWithAuth) GetAuthorizer() authorizer.Authorizer {
	return m.mockAuthorizer
}

type mockRegistration struct {
	groupVersion schema.GroupVersion
	authorizer   authorizer.Authorizer
}

type mockAuthorizerRegistrar struct {
	registrations []mockRegistration
}

func (m *mockAuthorizerRegistrar) Register(gv schema.GroupVersion, auth authorizer.Authorizer) {
	m.registrations = append(m.registrations, mockRegistration{
		groupVersion: gv,
		authorizer:   auth,
	})
}

type mockAuthorizer struct{}

func (m *mockAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	return authorizer.DecisionAllow, "test", nil
}

func (m *mockAuthorizer) ConditionsAwareAuthorize(ctx context.Context, attr authorizer.Attributes) authorizer.ConditionsAwareDecision {
	return authorizer.ConditionsAwareDecisionFromParts(m.Authorize(ctx, attr))
}

func (m *mockAuthorizer) EvaluateConditions(_ context.Context, _ authorizer.ConditionsAwareDecision, _ authorizer.ConditionsData) (authorizer.Decision, string, error) {
	return authorizer.DecisionDeny, "", authorizer.ErrorConditionEvaluationNotSupported
}

func TestRegisterStorageOptions(t *testing.T) {
	makeManifest := func(group string, kinds ...app.ManifestVersionKind) *app.ManifestData {
		return &app.ManifestData{
			AppName: "test-app",
			Group:   group,
			Versions: []app.ManifestVersion{
				{Name: "v0alpha1", Kinds: kinds},
			},
		}
	}

	t.Run("installer without StorageOptionsProvider is a no-op", func(t *testing.T) {
		installer := &mockAppInstaller{
			groupVersions: []schema.GroupVersion{{Group: "test.example.com", Version: "v1"}},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))
	})

	t.Run("registers options for resources where provider returns non-nil", func(t *testing.T) {
		enabledResource := "foos"
		var called []schema.GroupResource
		installer := &mockAppInstallerWithStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest: makeManifest("test.grafana.app",
				app.ManifestVersionKind{Kind: "Foo", Plural: enabledResource},
				app.ManifestVersionKind{Kind: "Bar", Plural: "bars"},
			),
			getOpts: func(gr schema.GroupResource) *apistore.StorageOptions {
				called = append(called, gr)
				if gr.Resource == enabledResource {
					return &apistore.StorageOptions{EnableFolderSupport: true}
				}
				return nil
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		require.Len(t, called, 2)
		assert.Contains(t, called, schema.GroupResource{Group: "test.grafana.app", Resource: enabledResource})
		assert.Contains(t, called, schema.GroupResource{Group: "test.grafana.app", Resource: "bars"})
	})

	t.Run("calls provider once when same resource appears in multiple versions", func(t *testing.T) {
		callCount := 0
		installer := &mockAppInstallerWithStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest: &app.ManifestData{
				AppName: "test-app",
				Group:   "test.grafana.app",
				Versions: []app.ManifestVersion{
					{Name: "v0alpha1", Kinds: []app.ManifestVersionKind{{Kind: "Foo", Plural: "foos"}}},
					{Name: "v1", Kinds: []app.ManifestVersionKind{{Kind: "Foo", Plural: "foos"}}},
				},
			},
			getOpts: func(gr schema.GroupResource) *apistore.StorageOptions {
				callCount++
				return &apistore.StorageOptions{EnableFolderSupport: true}
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		assert.Equal(t, 1, callCount)
	})
}

type mockAppInstallerWithStorageOpts struct {
	*mockAppInstaller
	manifest *app.ManifestData
	getOpts  func(schema.GroupResource) *apistore.StorageOptions
}

func (m *mockAppInstallerWithStorageOpts) ManifestData() *app.ManifestData {
	return m.manifest
}

func (m *mockAppInstallerWithStorageOpts) GetStorageOptions(gr schema.GroupResource) *apistore.StorageOptions {
	return m.getOpts(gr)
}

type mockAppInstallerWithVersionedStorageOpts struct {
	*mockAppInstaller
	manifest         *app.ManifestData
	getOpts          func(schema.GroupResource) *apistore.StorageOptions
	getVersionedOpts func(schema.GroupVersionResource) *apistore.StorageOptions
}

func (m *mockAppInstallerWithVersionedStorageOpts) ManifestData() *app.ManifestData {
	return m.manifest
}

func (m *mockAppInstallerWithVersionedStorageOpts) GetStorageOptions(gr schema.GroupResource) *apistore.StorageOptions {
	if m.getOpts == nil {
		return nil
	}
	return m.getOpts(gr)
}

func (m *mockAppInstallerWithVersionedStorageOpts) GetVersionedStorageOptions(gvr schema.GroupVersionResource) *apistore.StorageOptions {
	if m.getVersionedOpts == nil {
		return nil
	}
	return m.getVersionedOpts(gvr)
}

// twoVersionManifest serves one kind under both versions, the shape that a
// GroupResource key cannot describe.
func twoVersionManifest(group string) *app.ManifestData {
	return &app.ManifestData{
		AppName: "test-app",
		Group:   group,
		Versions: []app.ManifestVersion{
			{Name: "v1alpha1", Served: true, Kinds: []app.ManifestVersionKind{{Kind: "Foo", Plural: "Foos"}}},
			{Name: "v2alpha1", Served: true, Kinds: []app.ManifestVersionKind{{Kind: "Foo", Plural: "Foos"}}},
		},
	}
}

func TestRegisterVersionedStorageOptions(t *testing.T) {
	const group = "test.grafana.app"
	v1 := schema.GroupVersionResource{Group: group, Version: "v1alpha1", Resource: "foos"}
	v2 := schema.GroupVersionResource{Group: group, Version: "v2alpha1", Resource: "foos"}

	// ForResource returns the getter itself for a GVR with nothing registered,
	// and a distinct scoped getter for one that has -- which is how a caller
	// outside apistore can tell whether a registration took.
	scoped := func(t *testing.T, reg *apistore.RESTOptionsGetter, gvr schema.GroupVersionResource) bool {
		t.Helper()
		return reg.ForResource(gvr) != generic.RESTOptionsGetter(reg)
	}

	t.Run("each served version is asked and registered separately", func(t *testing.T) {
		var asked []schema.GroupVersionResource
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(gvr schema.GroupVersionResource) *apistore.StorageOptions {
				asked = append(asked, gvr)
				return &apistore.StorageOptions{EnableFolderSupport: true, RequireFolder: gvr.Version == "v1alpha1"}
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		assert.ElementsMatch(t, []schema.GroupVersionResource{v1, v2}, asked,
			"both versions are asked, and the plural is lower-cased into the resource name")
		assert.True(t, scoped(t, reg, v1))
		assert.True(t, scoped(t, reg, v2), "the second version is not skipped as a duplicate")
	})

	t.Run("a declined version falls back to the unversioned provider", func(t *testing.T) {
		var unversioned []schema.GroupResource
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(gvr schema.GroupVersionResource) *apistore.StorageOptions {
				if gvr.Version != "v1alpha1" {
					return nil // decline
				}
				return &apistore.StorageOptions{RequireFolder: true}
			},
			getOpts: func(gr schema.GroupResource) *apistore.StorageOptions {
				unversioned = append(unversioned, gr)
				return &apistore.StorageOptions{MaximumNameLength: 40}
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		assert.Equal(t, []schema.GroupResource{{Group: group, Resource: "foos"}}, unversioned,
			"only the declined version consults the GroupResource provider")
		assert.True(t, scoped(t, reg, v1), "the accepted version got its own entry")
		assert.False(t, scoped(t, reg, v2), "the declined version resolves through the shared getter")
	})

	// A provider naming a version its resource does not serve is a config error,
	// not something to paper over: it would store objects under an apiVersion no
	// served version accounts for.
	t.Run("a GVK outside the registered group version fails startup", func(t *testing.T) {
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(gvr schema.GroupVersionResource) *apistore.StorageOptions {
				return &apistore.StorageOptions{
					GVK: schema.GroupVersionKind{Group: group, Version: "v9alpha1", Kind: "Foo"},
				}
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		err := registerStorageOptions(installer, reg, logging.DefaultLogger)

		require.Error(t, err)
		require.Contains(t, err.Error(), "v9alpha1")
		require.False(t, scoped(t, reg, v1), "a rejected app registers nothing at all")
	})

	t.Run("an installer with neither provider registers nothing", func(t *testing.T) {
		installer := &mockAppInstaller{
			groupVersions: []schema.GroupVersion{{Group: group, Version: "v1alpha1"}},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))
		assert.False(t, scoped(t, reg, v1))
	})
}
