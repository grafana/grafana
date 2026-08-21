package pluginmanifest

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// TestManifestObjectGroupIsolation reproduces the create-time group-mismatch condition:
// a scheme in which the generic object type is registered under GVKs from multiple
// unrelated groups. With a bare resource.UntypedObject (shared across apps) ObjectKinds
// returns all groups, allowing a cross-app group to be stamped. With the dedicated
// manifestObject type, ObjectKinds only ever returns this package's registrations, all of
// which share the plugin's group.
func TestManifestObjectGroupIsolation(t *testing.T) {
	pluginGVK := schema.GroupVersionKind{Group: "stevetestapp.ext.grafana.app", Version: "v1", Kind: "Thing"}
	otherGVK := schema.GroupVersionKind{Group: "quotas.grafana.app", Version: "v0alpha1", Kind: "none"}

	t.Run("bare UntypedObject leaks foreign groups (demonstrates the bug)", func(t *testing.T) {
		scheme := runtime.NewScheme()
		// Two different apps register the SAME Go type under their own GVKs.
		scheme.AddKnownTypeWithName(pluginGVK, &resource.UntypedObject{})
		scheme.AddKnownTypeWithName(otherGVK, &resource.UntypedObject{})

		gvks, _, err := scheme.ObjectKinds(&resource.UntypedObject{})
		require.NoError(t, err)

		groups := map[string]bool{}
		for _, gvk := range gvks {
			groups[gvk.Group] = true
		}
		// The shared type is associated with BOTH groups - this is what lets the wrong
		// group be stamped onto a created object.
		require.True(t, groups["stevetestapp.ext.grafana.app"])
		require.True(t, groups["quotas.grafana.app"])
	})

	t.Run("manifestObject only ever maps to its own app's group", func(t *testing.T) {
		scheme := runtime.NewScheme()
		// Our dedicated type registered under the plugin's GVKs.
		scheme.AddKnownTypeWithName(pluginGVK, &manifestObject{})
		scheme.AddKnownTypeWithName(
			schema.GroupVersionKind{Group: pluginGVK.Group, Version: pluginGVK.Version, Kind: "none"},
			&manifestObject{},
		)
		// A different app registers the bare UntypedObject - it must NOT contaminate ours.
		scheme.AddKnownTypeWithName(otherGVK, &resource.UntypedObject{})

		gvks, _, err := scheme.ObjectKinds(&manifestObject{})
		require.NoError(t, err)
		require.NotEmpty(t, gvks)
		for _, gvk := range gvks {
			require.Equal(t, "stevetestapp.ext.grafana.app", gvk.Group,
				"manifestObject must only resolve to the plugin's group, got %s", gvk.Group)
		}
	})
}

// TestManifestObjectCopyPreservesType guards the easy-to-miss requirement that Copy()
// (used by resource.SimpleSchema.ZeroValue) returns the wrapper type, not a bare
// UntypedObject - otherwise the scheme would register the wrong (shared) type.
func TestManifestObjectCopyPreservesType(t *testing.T) {
	o := &manifestObject{}
	o.Spec = map[string]any{"foo": "bar"}
	cpy := o.Copy()
	_, ok := cpy.(*manifestObject)
	require.True(t, ok, "Copy() must return *manifestObject, got %T", cpy)

	l := &manifestList{}
	cpyList := l.Copy()
	_, ok = cpyList.(*manifestList)
	require.True(t, ok, "Copy() must return *manifestList, got %T", cpyList)
}

// TestManifestObjectJSONRoundTrip confirms the wrapper serializes identically to the
// embedded UntypedObject, so storage encoding is unchanged.
func TestManifestObjectJSONRoundTrip(t *testing.T) {
	o := &manifestObject{}
	o.APIVersion = "stevetestapp.ext.grafana.app/v1"
	o.Kind = "Thing"
	o.ObjectMeta = metav1.ObjectMeta{Name: "thing-1", Namespace: "default"}
	o.Spec = map[string]any{"foo": "bar"}

	wrapped, err := json.Marshal(o)
	require.NoError(t, err)

	bare, err := json.Marshal(&o.UntypedObject)
	require.NoError(t, err)

	require.JSONEq(t, string(bare), string(wrapped))
}

// TestManifestKindTypesAreDistinctPerKind reproduces the duplicate-operation-ID condition:
// when several kinds of one app share a single Go type, the reverse lookup the REST
// installer uses (scheme.ObjectKinds, via GetResourceKind) cannot tell them apart and
// returns the first-registered kind for all of them. Every kind then derives the same
// operation IDs and the API server refuses to serve the group with
// "duplicate Operation ID ...". Distinct per-kind types keep the lookup unambiguous.
func TestManifestKindTypesAreDistinctPerKind(t *testing.T) {
	group := "stevetestapp.ext.grafana.app"
	ticketGVK := schema.GroupVersionKind{Group: group, Version: "v1alpha1", Kind: "Ticket"}
	commentGVK := schema.GroupVersionKind{Group: group, Version: "v1alpha1", Kind: "Comment"}

	t.Run("one shared type collapses both kinds onto the first (demonstrates the bug)", func(t *testing.T) {
		scheme := runtime.NewScheme()
		scheme.AddKnownTypeWithName(ticketGVK, &manifestObject{})
		scheme.AddKnownTypeWithName(commentGVK, &manifestObject{})

		gvks, _, err := scheme.ObjectKinds(&manifestObject{})
		require.NoError(t, err)
		// Both kinds map to the same type, so a Comment's storage object is indistinguishable
		// from a Ticket's and the installer picks whichever came first.
		// The single type resolves to BOTH kinds, so the installer cannot tell which kind a
		// given storage object belongs to and uses gvks[0] for both resources.
		require.Len(t, gvks, 2)
		require.ElementsMatch(t, []schema.GroupVersionKind{ticketGVK, commentGVK}, gvks)
	})

	t.Run("a type per kind resolves each kind uniquely", func(t *testing.T) {
		scheme := runtime.NewScheme()
		ticketObj, ticketList := newManifestKindTypes(0)
		commentObj, commentList := newManifestKindTypes(1)

		scheme.AddKnownTypeWithName(ticketGVK, ticketObj)
		scheme.AddKnownTypeWithName(commentGVK, commentObj)

		ticketKinds, _, err := scheme.ObjectKinds(ticketObj)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupVersionKind{ticketGVK}, ticketKinds)

		commentKinds, _, err := scheme.ObjectKinds(commentObj)
		require.NoError(t, err)
		require.Equal(t, []schema.GroupVersionKind{commentGVK}, commentKinds)

		// The list types must be distinct too: list operation IDs are derived the same way.
		require.NotEqual(t, goReflectPath(ticketList), goReflectPath(commentList))
	})

	t.Run("Copy preserves the per-kind type", func(t *testing.T) {
		// SimpleSchema.ZeroValue goes through Copy(); if Copy returned the embedded type the
		// scheme would register the shared type again and the fix would silently regress.
		obj, list := newManifestKindTypes(3)
		require.Equal(t, goReflectPath(obj), goReflectPath(obj.Copy()))
		require.Equal(t, goReflectPath(list), goReflectPath(list.Copy()))
	})

	t.Run("every slot in the pool is a distinct type", func(t *testing.T) {
		seen := make(map[string]struct{}, manifestKindTypeCount)
		for i := range manifestKindTypeCount {
			obj, list := newManifestKindTypes(i)
			for _, path := range []string{goReflectPath(obj), goReflectPath(list)} {
				_, dup := seen[path]
				require.False(t, dup, "duplicate type %s at slot %d", path, i)
				seen[path] = struct{}{}
			}
		}
	})
}
