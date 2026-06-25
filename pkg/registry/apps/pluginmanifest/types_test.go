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
