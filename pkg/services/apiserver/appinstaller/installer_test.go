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
	// installedWith records the getter InstallAPIs handed this installer, which is
	// the one the app-sdk will resolve every store's options through.
	installedWith generic.RESTOptionsGetter
}

func (m *mockAppInstallerWithVersionedStorageOpts) InstallAPIs(_ appsdkapiserver.GenericAPIServer, optsGetter generic.RESTOptionsGetter) error {
	m.installedWith = optsGetter
	return nil
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

// resolvesPerVersion reports whether getter answers gvr with storage options of
// its own, resolved exactly the way the app-sdk installer resolves it: assert the
// getter to RESTOptionsGetterForResource, ask ForResource for the GVR whose store
// is about to be built, and read back nil or the receiver itself as "nothing
// registered for this version".
//
// Going through the SDK interface rather than calling ForResource directly is
// what ties these tests to the path that actually runs. A versioned registration
// has no other reader, and the SDK falls back to using the getter unchanged when
// the assertion fails -- so a drifted interface would leave every registration
// unread with no build failure to say so.
func resolvesPerVersion(t *testing.T, getter generic.RESTOptionsGetter, gvr schema.GroupVersionResource) bool {
	t.Helper()
	forResource, ok := getter.(appsdkapiserver.RESTOptionsGetterForResource)
	require.True(t, ok, "the app-sdk installer would not recognise %T, and would build every store with unscoped options", getter)
	scoped := forResource.ForResource(gvr)
	return scoped != nil && scoped != getter
}

func TestRegisterVersionedStorageOptions(t *testing.T) {
	const group = "test.grafana.app"
	v1 := schema.GroupVersionResource{Group: group, Version: "v1alpha1", Resource: "foos"}
	v2 := schema.GroupVersionResource{Group: group, Version: "v2alpha1", Resource: "foos"}

	// apistore refuses a registration whose GVK has no Kind, and a provider that
	// only cares about folder scope has no reason to name one. The installer fills
	// it in from the manifest, so this registration succeeding is what proves it
	// did -- a kindless GVK would otherwise be stored, and its empty Kind written
	// onto every object.
	t.Run("the manifest kind completes a provider's GVK", func(t *testing.T) {
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(schema.GroupVersionResource) *apistore.StorageOptions {
				return &apistore.StorageOptions{EnableFolderSupport: true} // no GVK of its own
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		assert.True(t, resolvesPerVersion(t, reg, v1))
		assert.True(t, resolvesPerVersion(t, reg, v2))
	})

	// The provider hands back a pointer, which it is free to keep. Filling the
	// Kind in on that value would leave one version's kind behind in it.
	t.Run("a provider's own options are left untouched", func(t *testing.T) {
		shared := &apistore.StorageOptions{EnableFolderSupport: true}
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(schema.GroupVersionResource) *apistore.StorageOptions {
				return shared
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		require.Empty(t, shared.GVK.Kind, "the installer must complete a copy, not the provider's value")
	})

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
		assert.True(t, resolvesPerVersion(t, reg, v1))
		assert.True(t, resolvesPerVersion(t, reg, v2), "the second version is not skipped as a duplicate")
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
		assert.True(t, resolvesPerVersion(t, reg, v1), "the accepted version got its own entry")
		assert.False(t, resolvesPerVersion(t, reg, v2), "the declined version resolves through the shared getter")
	})

	// A provider is allowed to name the kind, as long as it names the one the
	// manifest serves under that resource.
	t.Run("a provider may restate the manifest kind", func(t *testing.T) {
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(gvr schema.GroupVersionResource) *apistore.StorageOptions {
				return &apistore.StorageOptions{GVK: gvr.GroupVersion().WithKind("Foo")}
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))

		assert.True(t, resolvesPerVersion(t, reg, v1))
		assert.True(t, resolvesPerVersion(t, reg, v2))
	})

	// A Kind is the one part of the GVK that apistore cannot check, since the GVR
	// key names no kind. So a provider typo would be honoured: checkGVK applies the
	// configured kind to any write whose object arrived without complete type
	// metadata, persisting objects as a kind the resource does not serve. The
	// installer has the manifest, so it is the only place this can be caught.
	t.Run("a kind the manifest does not serve fails startup", func(t *testing.T) {
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getVersionedOpts: func(gvr schema.GroupVersionResource) *apistore.StorageOptions {
				return &apistore.StorageOptions{GVK: gvr.GroupVersion().WithKind("Fooo")} // typo
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		err := registerStorageOptions(installer, reg, logging.DefaultLogger)

		require.Error(t, err)
		require.Contains(t, err.Error(), "Fooo", "the message names the kind that was declared")
		require.Contains(t, err.Error(), "Foo", "and the kind the manifest serves")
		require.False(t, resolvesPerVersion(t, reg, v1), "a rejected app registers nothing at all")
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
		require.False(t, resolvesPerVersion(t, reg, v1), "a rejected app registers nothing at all")
	})

	// The unversioned provider is keyed by GroupResource, which names no version,
	// so a GVK declared through it can be neither completed nor checked -- and
	// checkGVK would take the versionless result as a declaration and persist
	// writes with an empty apiVersion. Same severity as the versioned cases, since
	// the consequence is the same.
	t.Run("a GVK declared through the unversioned provider fails startup", func(t *testing.T) {
		installer := &mockAppInstallerWithVersionedStorageOpts{
			mockAppInstaller: &mockAppInstaller{},
			manifest:         twoVersionManifest(group),
			getOpts: func(schema.GroupResource) *apistore.StorageOptions {
				return &apistore.StorageOptions{GVK: schema.GroupVersionKind{Kind: "Foo"}}
			},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		err := registerStorageOptions(installer, reg, logging.DefaultLogger)

		require.Error(t, err)
		require.Contains(t, err.Error(), "VersionedStorageOptionsProvider",
			"the message points at the interface that can carry a GVK")
	})

	t.Run("an installer with neither provider registers nothing", func(t *testing.T) {
		installer := &mockAppInstaller{
			groupVersions: []schema.GroupVersion{{Group: group, Version: "v1alpha1"}},
		}
		reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
		require.NoError(t, registerStorageOptions(installer, reg, logging.DefaultLogger))
		assert.False(t, resolvesPerVersion(t, reg, v1))
	})
}

// The registrations only reach storage if the getter they were written on is the
// same one InstallAPIs hands the app-sdk installer -- registering on one getter
// and installing with another would leave the versioned map unread, and every
// version of a kind back on the single answer keyed by GroupResource.
func TestInstallAPIsInstallsWithTheRegisteredGetter(t *testing.T) {
	const group = "test.grafana.app"
	v1 := schema.GroupVersionResource{Group: group, Version: "v1alpha1", Resource: "foos"}
	v2 := schema.GroupVersionResource{Group: group, Version: "v2alpha1", Resource: "foos"}

	installer := &mockAppInstallerWithVersionedStorageOpts{
		mockAppInstaller: &mockAppInstaller{groupVersions: []schema.GroupVersion{{Group: group, Version: "v1alpha1"}}},
		manifest:         twoVersionManifest(group),
		getVersionedOpts: func(gvr schema.GroupVersionResource) *apistore.StorageOptions {
			if gvr.Version != "v1alpha1" {
				return nil // only one version opts in
			}
			return &apistore.StorageOptions{EnableFolderSupport: true, RequireFolder: true}
		},
	}
	reg := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)

	require.NoError(t, InstallAPIs(
		context.Background(),
		[]appsdkapiserver.AppInstaller{installer},
		nil, // GenericAPIServer, only reached once an installer installs a group
		reg,
		nil, // storage options
		nil, // dual write service
		nil, // builder metrics
		nil, // api resource config
	))

	require.Same(t, reg, installer.installedWith,
		"the app-sdk resolves options through the getter it is installed with, so it has to be the one registerStorageOptions wrote to")
	assert.True(t, resolvesPerVersion(t, installer.installedWith, v1),
		"the version that opted in resolves to its own options through the getter the app-sdk was given")
	assert.False(t, resolvesPerVersion(t, installer.installedWith, v2),
		"the version that declined still falls through to the shared getter")
}

// A server with no RESTOptionsGetter installs against a noop, and an app that
// declares storage options is not a reason to refuse it: unified storage is
// already unavailable, which InstallAPIs warns about once for the whole server.
//
// This covers the noop substitution, not which value registerStorageOptions is
// handed -- a nil getter and the noop are indistinguishable to it, since neither
// is a *apistore.RESTOptionsGetter. Registering on the same getter that gets
// installed is true by construction in InstallAPIs rather than pinned here.
func TestInstallAPIsWithoutARESTOptionsGetter(t *testing.T) {
	const group = "test.grafana.app"

	installer := &mockAppInstallerWithVersionedStorageOpts{
		mockAppInstaller: &mockAppInstaller{groupVersions: []schema.GroupVersion{{Group: group, Version: "v1alpha1"}}},
		manifest:         twoVersionManifest(group),
		getVersionedOpts: func(schema.GroupVersionResource) *apistore.StorageOptions {
			return &apistore.StorageOptions{EnableFolderSupport: true}
		},
	}

	require.NoError(t, InstallAPIs(
		context.Background(),
		[]appsdkapiserver.AppInstaller{installer},
		nil, // GenericAPIServer
		nil, // no RESTOptionsGetter
		nil, // storage options
		nil, // dual write service
		nil, // builder metrics
		nil, // api resource config
	))

	require.NotNil(t, installer.installedWith, "the app-sdk is never installed with a nil getter")
	_, isForResource := installer.installedWith.(appsdkapiserver.RESTOptionsGetterForResource)
	assert.False(t, isForResource,
		"the noop getter serves no per-version options, so it must not claim to -- the app-sdk would ask it and get nothing")
}
