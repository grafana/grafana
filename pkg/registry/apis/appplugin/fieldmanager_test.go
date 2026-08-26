package appplugin

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func newTestResource() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "test-app/v0alpha1",
		"kind":       "TestKind",
		"metadata": map[string]any{
			"generateName": "x",
			"namespace":    "default",
			"annotations":  map[string]any{"grafana.app/folder": "dfwba49521a80b"},
		},
		"spec":   map[string]any{"title": "title", "description": "description"},
		"status": map[string]any{"state": "imported"},
	}}
}

// The generic create handler cannot diff an unstructured kind against the
// kindless empty object the scheme hands it, so it logs "[SHOULD NOT HAPPEN]
// failed to update managedFields" and strips them. The store redoes that diff.
func TestKindStoreTrackManagedFields(t *testing.T) {
	obj := testKindStore(false, true).
		trackManagedFields(newTestResource(), &metav1.CreateOptions{FieldManager: "test-manager"})

	entries := obj.(*unstructured.Unstructured).GetManagedFields()
	require.Len(t, entries, 1, "the create is tracked as one entry")
	require.Equal(t, "test-manager", entries[0].Manager)
	require.Equal(t, metav1.ManagedFieldsOperationUpdate, entries[0].Operation)
	require.Equal(t, "test-app/v0alpha1", entries[0].APIVersion)

	var fields map[string]any
	require.NoError(t, json.Unmarshal(entries[0].FieldsV1.Raw, &fields))
	require.Contains(t, fields, "f:spec")
	require.Contains(t, fields, "f:metadata")
	require.NotContains(t, fields, "f:status", "the status subresource is not owned by a create")
}

func TestKindStoreTrackManagedFieldsWithoutStatusSubresource(t *testing.T) {
	obj := testKindStore(false, false).
		trackManagedFields(newTestResource(), &metav1.CreateOptions{FieldManager: "test-manager"})

	var fields map[string]any
	require.NoError(t, json.Unmarshal(obj.(*unstructured.Unstructured).GetManagedFields()[0].FieldsV1.Raw, &fields))
	require.Contains(t, fields, "f:status", "without the subresource, status is ordinary payload")
}

// Only requests made through a client that names itself carry a field manager;
// the generic handler falls back to the user agent, which storage cannot see.
func TestKindStoreTrackManagedFieldsUnnamedManager(t *testing.T) {
	obj := testKindStore(false, true).trackManagedFields(newTestResource(), &metav1.CreateOptions{})
	entries := obj.(*unstructured.Unstructured).GetManagedFields()
	require.Len(t, entries, 1)
	require.Equal(t, defaultFieldManager, entries[0].Manager)
}

func TestUnstructuredCreator(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"}
	obj, err := unstructuredCreator{}.New(gvk)
	require.NoError(t, err)
	// The kind is the whole point: the scheme's creator leaves it empty, and an
	// unstructured object without one cannot be converted to any version.
	require.Equal(t, gvk, obj.GetObjectKind().GroupVersionKind())
}

func TestUnstructuredConvertor(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"}
	in := newTestResource()

	t.Run("stamps the target version on a copy", func(t *testing.T) {
		out, err := unstructuredConvertor{}.ConvertToVersion(in, schema.GroupVersion{Group: "test-app", Version: "v1beta1"})
		require.NoError(t, err)
		require.Equal(t, gvk, in.GroupVersionKind(), "the submitted object is left alone")
		require.Equal(t, schema.GroupVersionKind{Group: "test-app", Version: "v1beta1", Kind: "TestKind"},
			out.(*unstructured.Unstructured).GroupVersionKind())
	})

	t.Run("rejects another group", func(t *testing.T) {
		_, err := unstructuredConvertor{}.ConvertToVersion(in, schema.GroupVersion{Group: "other-app", Version: "v0alpha1"})
		require.Error(t, err)
	})
}
