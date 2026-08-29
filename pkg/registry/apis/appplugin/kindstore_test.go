package appplugin

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
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
	fieldManager, err := newKindFieldManager(s.gvk, s.GetResetFields())
	if err != nil {
		panic(err)
	}
	s.fieldManager = fieldManager
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

// The strategy answers these the same way for every manifest kind; they exist
// because registry.Store requires the full strategy interfaces.
func TestKindStoreStrategyDefaults(t *testing.T) {
	s := testKindStore(false, false)

	require.False(t, s.AllowCreateOnUpdate())
	require.False(t, s.AllowUnconditionalUpdate())
	require.Nil(t, s.WarningsOnCreate(context.Background(), nil))
	require.Nil(t, s.WarningsOnUpdate(context.Background(), nil, nil))

	obj := &unstructured.Unstructured{Object: map[string]any{"spec": map[string]any{}}}
	s.Canonicalize(obj)
	require.Equal(t, map[string]any{"spec": map[string]any{}}, obj.Object)

	// The kind is served as a single version, so typing never has to guess.
	kinds, unversioned, err := s.ObjectKinds(obj)
	require.NoError(t, err)
	require.False(t, unversioned)
	require.Equal(t, []schema.GroupVersionKind{s.gvk}, kinds)

	require.True(t, s.Recognizes(s.gvk))
	require.False(t, s.Recognizes(s.gvk.GroupVersion().WithKind("Other")))
}

// Every strategy hook must survive an object it did not expect: registry.Store
// hands them whatever the request decoded to.
func TestKindStoreIgnoresNonUnstructured(t *testing.T) {
	s := testKindStore(false, true)
	s.validator = buildTestKindValidator(t, "v0alpha1")
	other := &metav1.Status{}

	require.NotPanics(t, func() {
		s.PrepareForCreate(context.Background(), other)
		s.PrepareForUpdate(context.Background(), other, other)
		require.Same(t, other, s.trackManagedFields(other, &metav1.CreateOptions{}))
	})
	require.Empty(t, s.Validate(context.Background(), other),
		"an object that is not unstructured cannot be schema checked")

	// A well-formed update against a non-unstructured stored object leaves the
	// incoming status alone rather than erroring.
	obj := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"state": "new"},
	}}
	s.PrepareForUpdate(context.Background(), obj, other)
	state, _, _ := unstructured.NestedString(obj.Object, "status", "state")
	require.Equal(t, "new", state)
}

// Without a status subresource, status is ordinary payload on update too.
func TestKindStorePrepareForUpdateWithoutStatus(t *testing.T) {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"state": "new"},
	}}
	old := &unstructured.Unstructured{Object: map[string]any{
		"status": map[string]any{"state": "old"},
	}}
	testKindStore(false, false).PrepareForUpdate(context.Background(), obj, old)

	state, _, _ := unstructured.NestedString(obj.Object, "status", "state")
	require.Equal(t, "new", state)
}

func TestKindTableConvertorPriority(t *testing.T) {
	gr := schema.GroupResource{Group: "test-app", Resource: "testkinds"}
	gvk := schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"}
	priority := int32(1)

	tc := newKindTableConvertor(gr, gvk, app.ManifestVersionKind{
		AdditionalPrinterColumns: []app.ManifestVersionKindAdditionalPrinterColumn{
			{Name: "Test Field", Type: "integer", JSONPath: ".spec.testField", Priority: &priority},
		},
	})
	table, err := tc.ConvertToTable(context.Background(), &unstructured.Unstructured{Object: map[string]any{
		"metadata": map[string]any{"name": "x"},
		"spec":     map[string]any{"testField": int64(42)},
	}}, nil)
	require.NoError(t, err)

	last := table.ColumnDefinitions[len(table.ColumnDefinitions)-1]
	require.Equal(t, "Test Field", last.Name)
	require.Equal(t, priority, last.Priority, "the manifest priority reaches the table output")
}

// newKindStoreOpts builds the options UpdateAPIGroupInfo passes in, recording
// what the kind registers with unified storage.
func newKindStoreOpts(t *testing.T, gvk schema.GroupVersionKind) (*builder.APIGroupOptions, map[schema.GroupResource]apistore.StorageOptions) {
	t.Helper()

	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(gvk, &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(gvk.GroupVersion().WithKind(gvk.Kind+"List"), &unstructured.UnstructuredList{})

	registered := map[schema.GroupResource]apistore.StorageOptions{}
	return &builder.APIGroupOptions{
		Scheme:     scheme,
		OptsGetter: apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil),
		StorageOptsRegister: func(gr schema.GroupResource, opts apistore.StorageOptions) {
			registered[gr] = opts
		},
	}, registered
}

func TestNewKindStore(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v1alpha1", Kind: "TestKind"}
	falseValue := false
	admission := &fakeRouteClient{}

	t.Run("a namespaced kind is folder scoped by default", func(t *testing.T) {
		opts, registered := newKindStoreOpts(t, gvk)
		s, err := newKindStore(gvk, app.ManifestVersionKind{
			Kind: "TestKind", Plural: "TestKinds", Scope: "Namespaced",
		}, admission, opts, nil)
		require.NoError(t, err)

		require.True(t, s.NamespaceScoped())
		// The plural names the REST path, so it is lower-cased.
		gr := schema.GroupResource{Group: "example-app", Resource: "testkinds"}
		require.Equal(t, gr, s.DefaultQualifiedResource)
		require.Equal(t, schema.GroupResource{Group: "example-app", Resource: "testkind"},
			s.SingularQualifiedResource)

		require.Equal(t, apistore.StorageOptions{
			EnableFolderSupport:  true,
			RequireFolder:        true,
			DeprecatedInternalID: apistore.DeprecatedID_None,
			Scheme:               opts.Scheme,
		}, registered[gr])

		// No schema means no body validation and no status subresource.
		require.Nil(t, s.validator)
		require.False(t, s.hasStatus)

		// The kind keeps the plugin client so admission hooks can reach it.
		require.Same(t, admission, s.admission)
	})

	t.Run("folderScoped false opts out of folder support", func(t *testing.T) {
		opts, registered := newKindStoreOpts(t, gvk)
		_, err := newKindStore(gvk, app.ManifestVersionKind{
			Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced", FolderScoped: &falseValue,
		}, admission, opts, nil)
		require.NoError(t, err)

		stored := registered[schema.GroupResource{Group: "example-app", Resource: "testkinds"}]
		require.False(t, stored.EnableFolderSupport)
		require.False(t, stored.RequireFolder)
	})

	t.Run("a cluster kind cannot use folders", func(t *testing.T) {
		opts, registered := newKindStoreOpts(t, gvk)
		s, err := newKindStore(gvk, app.ManifestVersionKind{
			Kind: "TestKind", Plural: "testkinds", Scope: clusterScope,
		}, admission, opts, nil)
		require.NoError(t, err)

		require.False(t, s.NamespaceScoped())
		stored := registered[schema.GroupResource{Group: "example-app", Resource: "testkinds"}]
		require.False(t, stored.EnableFolderSupport, "cluster kinds are outside the folder tree")
		require.False(t, stored.RequireFolder)
	})

	t.Run("a kind schema installs validation and the status subresource", func(t *testing.T) {
		manifest := testManifest(t)
		// NewAppPluginAPIBuilder serves manifest kinds under the plugin ID.
		manifest.Group = gvk.Group
		defs := loadOpenAPIDefinitions(func(name string) spec.Ref {
			return spec.MustCreateRef(name)
		}, gvk.Group, manifest)
		kind := manifest.Versions[1].Kinds[0] // v1alpha1 TestKind declares status

		opts, _ := newKindStoreOpts(t, gvk)
		s, err := newKindStore(gvk, kind, admission, opts, defs)
		require.NoError(t, err)

		require.NotNil(t, s.validator)
		require.True(t, s.hasStatus)

		// v0alpha1 has the same kind without a status property.
		v0 := schema.GroupVersionKind{Group: "example-app", Version: "v0alpha1", Kind: "TestKind"}
		opts, _ = newKindStoreOpts(t, v0)
		s, err = newKindStore(v0, manifest.Versions[0].Kinds[0], admission, opts, defs)
		require.NoError(t, err)
		require.NotNil(t, s.validator)
		require.False(t, s.hasStatus)
	})

	t.Run("a schema missing from the definitions is an error", func(t *testing.T) {
		opts, _ := newKindStoreOpts(t, gvk)
		kind := testManifest(t).Versions[1].Kinds[0]
		_, err := newKindStore(gvk, kind, admission, opts, map[string]common.OpenAPIDefinition{})
		require.ErrorContains(t, err, "missing expected schema key")
	})

	// The plural names the REST path; an empty one silently registers an
	// unreachable resource, so newKindStore rejects it up front.
	t.Run("a kind without a plural is an error", func(t *testing.T) {
		opts, _ := newKindStoreOpts(t, gvk)
		_, err := newKindStore(gvk, app.ManifestVersionKind{Kind: "TestKind"}, admission, opts, nil)
		require.ErrorContains(t, err, "missing a plural name")
	})

	t.Run("storage that cannot be completed is an error", func(t *testing.T) {
		opts, _ := newKindStoreOpts(t, gvk)
		opts.OptsGetter = failingRESTOptionsGetter{}
		_, err := newKindStore(gvk, app.ManifestVersionKind{
			Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced",
		}, admission, opts, nil)
		require.ErrorContains(t, err, "no storage configured")
	})

	// Objects are typed through these constructors, so both must stamp the GVK:
	// unified storage returns unstructured values that carry no Go type.
	t.Run("new objects carry the kind", func(t *testing.T) {
		opts, _ := newKindStoreOpts(t, gvk)
		s, err := newKindStore(gvk, app.ManifestVersionKind{
			Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced",
		}, admission, opts, nil)
		require.NoError(t, err)

		require.Equal(t, gvk, s.New().GetObjectKind().GroupVersionKind())
		require.Equal(t, gvk.GroupVersion().WithKind("TestKindList"),
			s.NewList().GetObjectKind().GroupVersionKind())
	})
}

// failingRESTOptionsGetter makes registry.Store.CompleteWithOptions fail.
type failingRESTOptionsGetter struct{}

func (failingRESTOptionsGetter) GetRESTOptions(schema.GroupResource, runtime.Object) (generic.RESTOptions, error) {
	return generic.RESTOptions{}, errors.New("no storage configured")
}

// A write to the status subresource may only change status. Without this the
// generic status strategy persists whatever spec the request carried, so status
// access is spec access -- and the spec it stores is never schema checked.
func TestKindStatusStrategyPrepareForUpdate(t *testing.T) {
	s := &kindStatusStrategy{kindStore: testKindStore(false, true)}

	old := &unstructured.Unstructured{Object: map[string]any{
		"spec":   map[string]any{"testField": int64(1)},
		"status": map[string]any{"state": "old"},
	}}
	old.SetLabels(map[string]string{"keep": "me"})
	old.SetAnnotations(map[string]string{"grafana.app/folder": "fold"})
	old.SetFinalizers([]string{"a-finalizer"})

	obj := &unstructured.Unstructured{Object: map[string]any{
		"spec":   map[string]any{"testField": int64(999)},
		"status": map[string]any{"state": "new"},
	}}
	obj.SetLabels(map[string]string{"sneaky": "label"})
	obj.SetAnnotations(map[string]string{"grafana.app/folder": "elsewhere"})
	obj.SetFinalizers(nil)

	s.PrepareForUpdate(context.Background(), obj, old)

	require.Equal(t, map[string]any{"state": "new"}, obj.Object["status"], "the status is the write")
	require.Equal(t, map[string]any{"testField": int64(1)}, obj.Object["spec"])
	require.Equal(t, map[string]string{"keep": "me"}, obj.GetLabels())
	require.Equal(t, map[string]string{"grafana.app/folder": "fold"}, obj.GetAnnotations())
	require.Equal(t, []string{"a-finalizer"}, obj.GetFinalizers())
	require.Equal(t, s.gvk, obj.GroupVersionKind())

	// An object stored before it had a spec must not gain one from the request.
	obj = &unstructured.Unstructured{Object: map[string]any{
		"spec":   map[string]any{"testField": int64(999)},
		"status": map[string]any{"state": "new"},
	}}
	s.PrepareForUpdate(context.Background(), obj, &unstructured.Unstructured{Object: map[string]any{}})
	require.NotContains(t, obj.Object, "spec")
}

// The status manager must not own the fields the status endpoint cannot write.
func TestKindStatusStrategyResetFields(t *testing.T) {
	s := &kindStatusStrategy{kindStore: testKindStore(false, true)}
	fields := s.GetResetFields()
	require.Len(t, fields, 1)
	set := fields[fieldpath.APIVersion(s.gvk.GroupVersion().String())]
	require.True(t, set.Has(fieldpath.MakePathOrDie("spec")))
	require.True(t, set.Has(fieldpath.MakePathOrDie("metadata")))
	require.False(t, set.Has(fieldpath.MakePathOrDie("status")))

	// Inherited from the kind, so a status write is schema checked like any other.
	require.Equal(t, s.kindStore.NamespaceScoped(), s.NamespaceScoped())
}
