package apistore

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/storage/storagebackend"
)

// resolvedOptions reports the StorageOptions a getter would build storage with.
// The by-GroupResource map and the scoped getters are separate code paths, so
// the helper covers both rather than reaching into one of them.
func resolvedOptions(t *testing.T, getter interface{}, gr schema.GroupResource) StorageOptions {
	t.Helper()
	switch g := getter.(type) {
	case *resourceOptionsGetter:
		return g.opts
	case *RESTOptionsGetter:
		return g.options[gr.String()]
	default:
		t.Fatalf("unexpected getter type %T", getter)
		return StorageOptions{}
	}
}

// Options registered for an exact GVR are how an installer that builds its own
// stores (the app-sdk one) gets per-version options: it cannot wrap the getter,
// so it asks ForResource instead.
func TestForResource(t *testing.T) {
	const group = "example.grafana.app"
	gr := schema.GroupResource{Group: group, Resource: "things"}
	v1 := gr.WithVersion("v1alpha1")
	v2 := gr.WithVersion("v2alpha1")

	newGetter := func() *RESTOptionsGetter {
		return NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
	}

	t.Run("versions of one resource keep their own options", func(t *testing.T) {
		r := newGetter()
		require.NoError(t, r.RegisterVersionedOptions(v1, StorageOptions{GVK: v1.GroupVersion().WithKind("Thing"), RequireFolder: true}))
		require.NoError(t, r.RegisterVersionedOptions(v2, StorageOptions{GVK: v2.GroupVersion().WithKind("Thing")}))

		first := resolvedOptions(t, r.ForResource(v1), gr)
		second := resolvedOptions(t, r.ForResource(v2), gr)

		require.True(t, first.RequireFolder)
		require.False(t, second.RequireFolder, "the later registration does not decide for the earlier one")
		require.Equal(t, "v1alpha1", first.GVK.Version)
		require.Equal(t, "v2alpha1", second.GVK.Version)
	})

	t.Run("a GVR with nothing registered falls back to the shared getter", func(t *testing.T) {
		r := newGetter()
		r.RegisterOptions(gr, StorageOptions{MaximumNameLength: 40})
		require.NoError(t, r.RegisterVersionedOptions(v1, StorageOptions{RequireFolder: true}))

		require.Same(t, r, r.ForResource(v2), "no versioned entry means no scoping")
		require.Equal(t, 40, resolvedOptions(t, r.ForResource(v2), gr).MaximumNameLength)

		// The versioned entry wins for the version that has one, and does not
		// inherit from the by-GroupResource registration.
		scoped := resolvedOptions(t, r.ForResource(v1), gr)
		require.True(t, scoped.RequireFolder)
		require.Zero(t, scoped.MaximumNameLength)
	})

	// The key already names the group and version, so a caller that gives only a
	// Kind still gets a complete GVK -- an omitted version would otherwise decide
	// the apiVersion writes persist under.
	t.Run("the key completes a GVK that names only a Kind", func(t *testing.T) {
		r := newGetter()
		require.NoError(t, r.RegisterVersionedOptions(v1, StorageOptions{GVK: schema.GroupVersionKind{Kind: "Thing"}}))

		require.Equal(t, v1.GroupVersion().WithKind("Thing"), resolvedOptions(t, r.ForResource(v1), gr).GVK)
	})

	t.Run("an empty GVK is completed to the key's kindless GVK", func(t *testing.T) {
		r := newGetter()
		require.NoError(t, r.RegisterVersionedOptions(v1, StorageOptions{RequireFolder: true}))

		got := resolvedOptions(t, r.ForResource(v1), gr).GVK
		require.Equal(t, group, got.Group)
		require.Equal(t, "v1alpha1", got.Version)
		require.Empty(t, got.Kind, "only the caller knows the kind name")
	})

	// A contradicting GVK is refused outright, so nothing is registered and the
	// resource keeps falling through to the shared getter.
	t.Run("a GVK that disagrees with the key registers nothing", func(t *testing.T) {
		r := newGetter()
		err := r.RegisterVersionedOptions(v1, StorageOptions{
			GVK: schema.GroupVersionKind{Group: group, Version: "v0alpha1", Kind: "Thing"},
		})
		require.Error(t, err)
		require.Same(t, r, r.ForResource(v1), "a rejected registration leaves no entry behind")
	})

	t.Run("an unregistered getter scopes nothing", func(t *testing.T) {
		r := newGetter()
		require.Same(t, r, r.ForResource(v1))
	})

	// The version is part of the key, so a resource of the same name in another
	// group or version cannot pick up these options.
	t.Run("the key is the whole GVR", func(t *testing.T) {
		r := newGetter()
		require.NoError(t, r.RegisterVersionedOptions(v1, StorageOptions{RequireFolder: true}))

		other := schema.GroupVersionResource{Group: "other.grafana.app", Version: "v1alpha1", Resource: "things"}
		require.Same(t, r, r.ForResource(other))
	})
}

// ForResource has to keep serving the RESTOptions the shared getter would, since
// only the StorageOptions are per resource.
func TestForResourceSharesTheParentConfig(t *testing.T) {
	r := NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil)
	gr := schema.GroupResource{Group: "example.grafana.app", Resource: "things"}
	gvr := gr.WithVersion("v1alpha1")
	require.NoError(t, r.RegisterVersionedOptions(gvr, StorageOptions{RequireFolder: true}))

	shared, err := r.GetRESTOptions(gr, nil)
	require.NoError(t, err)
	scoped, err := r.ForResource(gvr).GetRESTOptions(gr, nil)
	require.NoError(t, err)

	require.Equal(t, shared.ResourcePrefix, scoped.ResourcePrefix)
	require.Equal(t, gr, scoped.StorageConfig.GroupResource)
	require.Equal(t, shared.CountMetricPollPeriod, scoped.CountMetricPollPeriod)
}

// A GVK contradicting its key would persist writes under a version the storage
// does not serve, so the registration is refused rather than adjusted.
func TestRegisterVersionedOptionsRejectsGVKMismatch(t *testing.T) {
	const group = "example.grafana.app"
	gvr := schema.GroupResource{Group: group, Resource: "things"}.WithVersion("v1alpha1")

	register := func(t *testing.T, gvk schema.GroupVersionKind) error {
		t.Helper()
		return NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil).
			RegisterVersionedOptions(gvr, StorageOptions{GVK: gvk})
	}

	t.Run("a matching GVK is accepted", func(t *testing.T) {
		require.NoError(t, register(t, gvr.GroupVersion().WithKind("Thing")))
	})

	t.Run("an omitted group and version are filled in, not rejected", func(t *testing.T) {
		require.NoError(t, register(t, schema.GroupVersionKind{Kind: "Thing"}))
		require.NoError(t, register(t, schema.GroupVersionKind{}))
	})

	t.Run("a contradicting version is rejected", func(t *testing.T) {
		err := register(t, schema.GroupVersionKind{Group: group, Version: "v2alpha1", Kind: "Thing"})
		require.Error(t, err)
		require.Contains(t, err.Error(), "outside the group version they are registered for")
		require.Contains(t, err.Error(), gvr.String(), "the message names the resource that was rejected")
	})

	t.Run("a contradicting group is rejected", func(t *testing.T) {
		require.Error(t, register(t, schema.GroupVersionKind{Group: "other.grafana.app", Version: "v1alpha1", Kind: "Thing"}))
	})
}
