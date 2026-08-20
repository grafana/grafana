package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/app"
)

func testKindStore(clusterScoped, hasStatus bool) *kindStore {
	s := &kindStore{
		NameGenerator: names.SimpleNameGenerator,
		gvk:           schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"},
		clusterScoped: clusterScoped,
		hasStatus:     hasStatus,
	}
	// mirror the newKindStore wiring so scope checks route through the store
	s.Store = &registry.Store{CreateStrategy: s, UpdateStrategy: s, DeleteStrategy: s}
	return s
}

// The embedded registry.Store delegates NamespaceScoped to its CreateStrategy
// (the kindStore itself), so kindStore must provide an explicit
// implementation or the promoted method recurses forever.
func TestKindStoreScope(t *testing.T) {
	require.True(t, testKindStore(false, false).NamespaceScoped())
	require.False(t, testKindStore(true, false).NamespaceScoped())

	var scoper rest.Scoper = testKindStore(false, false).Store
	require.True(t, scoper.NamespaceScoped())
}

func TestKindStorePrepareForCreate(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec":   map[string]any{"testField": int64(1)},
		"status": map[string]any{"state": "imported"},
	}}
	testKindStore(false, true).PrepareForCreate(context.Background(), obj)
	_, found, _ := unstructured.NestedFieldNoCopy(obj.Object, "status")
	require.False(t, found, "the status subresource must not be writable through create")
	require.Equal(t, int64(1), obj.GetGeneration())

	obj = &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"state": "imported"},
	}}
	testKindStore(false, false).PrepareForCreate(context.Background(), obj)
	_, found, _ = unstructured.NestedFieldNoCopy(obj.Object, "status")
	require.True(t, found, "without a status subresource the field is normal payload")
}

func TestKindStorePrepareForUpdate(t *testing.T) {
	s := testKindStore(false, true)
	old := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"state": "old"},
	}}
	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec":   map[string]any{"testField": int64(2)},
		"status": map[string]any{"state": "new"},
	}}
	s.PrepareForUpdate(context.Background(), obj, old)
	state, _, _ := unstructured.NestedString(obj.Object, "status", "state")
	require.Equal(t, "old", state, "main-resource updates keep the stored status")

	// the preserved status must not alias the old object's map
	require.NoError(t, unstructured.SetNestedField(obj.Object, "changed", "status", "state"))
	state, _, _ = unstructured.NestedString(old.Object, "status", "state")
	require.Equal(t, "old", state)

	obj = &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"state": "new"},
	}}
	s.PrepareForUpdate(context.Background(), obj, &unstructured.Unstructured{Object: map[string]any{}})
	_, found, _ := unstructured.NestedFieldNoCopy(obj.Object, "status")
	require.False(t, found, "status cannot be introduced when the stored object has none")
}

func TestKindStoreValidate(t *testing.T) {
	s := testKindStore(false, false)
	require.Empty(t, s.Validate(context.Background(), &unstructured.Unstructured{Object: map[string]any{}}),
		"kinds without a schema are served without body validation")

	s.validator = buildTestKindValidator(t, "v0alpha1")
	valid := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "x"},
		"spec":     map[string]any{"testField": int64(42)},
	}}
	require.Empty(t, s.Validate(context.Background(), valid))
	require.Empty(t, s.ValidateUpdate(context.Background(), valid, valid))

	invalid := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "x"},
		"spec":     map[string]any{"testField": "not-an-integer"},
	}}
	require.NotEmpty(t, s.Validate(context.Background(), invalid))
	require.NotEmpty(t, s.ValidateUpdate(context.Background(), invalid, valid))
}

func TestKindStoreGetResetFields(t *testing.T) {
	require.Nil(t, testKindStore(false, false).GetResetFields())

	fields := testKindStore(false, true).GetResetFields()
	set := fields[fieldpath.APIVersion("test-app/v0alpha1")]
	require.NotNil(t, set)
	require.True(t, set.Has(fieldpath.MakePathOrDie("status")))
}

func TestKindTableConvertor(t *testing.T) {
	gr := schema.GroupResource{Group: "test-app", Resource: "testkinds"}
	gvk := schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"}
	obj := &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "x"},
		"spec":     map[string]any{"testField": int64(42)},
	}}

	tc := newKindTableConvertor(gr, gvk, app.ManifestVersionKind{
		AdditionalPrinterColumns: []app.ManifestVersionKindAdditionalPrinterColumn{
			{Name: "Test Field", Type: "integer", JSONPath: ".spec.testField"},
		},
	})
	table, err := tc.ConvertToTable(context.Background(), obj, nil)
	require.NoError(t, err)
	last := table.ColumnDefinitions[len(table.ColumnDefinitions)-1]
	require.Equal(t, "Test Field", last.Name)
	require.Len(t, table.Rows, 1)
	require.Equal(t, int64(42), table.Rows[0].Cells[len(table.Rows[0].Cells)-1])

	// an invalid JSONPath degrades to the default name+age table
	tc = newKindTableConvertor(gr, gvk, app.ManifestVersionKind{
		AdditionalPrinterColumns: []app.ManifestVersionKindAdditionalPrinterColumn{
			{Name: "Bad", Type: "string", JSONPath: "{{{"},
		},
	})
	table, err = tc.ConvertToTable(context.Background(), obj, nil)
	require.NoError(t, err)
	for _, c := range table.ColumnDefinitions {
		require.NotEqual(t, "Bad", c.Name)
	}
}
