package appplugin

import (
	"context"
	"fmt"
	"strings"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apiextensions-apiserver/pkg/apiserver/validation"
	"k8s.io/apiextensions-apiserver/pkg/registry/customresource/tableconvertor"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
	"k8s.io/kube-openapi/pkg/common"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// kindStore is the storage and REST strategy for a single manifest-defined
// kind. Manifest kinds are served as unstructured objects, so there is no Go
// type to carry validation or field trimming -- the manifest schema is the
// only source of truth, and this strategy applies it the way CRD storage does.
type kindStore struct {
	*registry.Store
	names.NameGenerator

	gvk           schema.GroupVersionKind
	kind          app.ManifestVersionKind
	clusterScoped bool

	// hasStatus marks status as a subresource: writes through the main
	// resource then cannot change it (see PrepareForCreate/Update)
	hasStatus bool

	// validator is nil when the kind legally omits its schema; such kinds
	// are served without body validation
	validator validation.SchemaValidator
}

var (
	_ rest.RESTCreateStrategy  = (*kindStore)(nil)
	_ rest.RESTUpdateStrategy  = (*kindStore)(nil)
	_ rest.RESTDeleteStrategy  = (*kindStore)(nil)
	_ rest.ResetFieldsStrategy = (*kindStore)(nil)
)

// newKindStore builds unified storage for one manifest kind. The store acts
// as its own create/update strategy so manifest schema validation and status
// subresource handling do not require wrapping a generic strategy.
func newKindStore(
	gvk schema.GroupVersionKind,
	kind app.ManifestVersionKind,
	opts *builder.APIGroupOptions,
	defs map[string]common.OpenAPIDefinition,
) (*kindStore, error) {
	gr := schema.GroupResource{Group: gvk.Group, Resource: strings.ToLower(kind.Plural)}
	listGVK := gvk.GroupVersion().WithKind(gvk.Kind + "List")
	clusterScoped := kind.Scope == "Cluster"

	keyFunc := grafanaregistry.NamespaceKeyFunc(gr)
	if clusterScoped {
		keyFunc = grafanaregistry.ClusterScopedKeyFunc(gr)
	}

	wrap := &kindStore{
		NameGenerator: names.SimpleNameGenerator,
		gvk:           gvk,
		kind:          kind,
		clusterScoped: clusterScoped,
	}

	// A kind may legally omit its schema; serve it without body validation.
	if kind.Schema != nil {
		key := kindOpenAPIName(gvk)
		def, found := defs[key]
		if !found {
			return nil, fmt.Errorf("missing expected schema key %s", key)
		}
		wrap.validator = newKindSchemaValidator(def.Schema, defs)
		_, wrap.hasStatus = def.Schema.Properties["status"]
	}

	// Storage options must be registered before CompleteWithOptions asks the
	// options getter for this resource. Scope and folder settings must match
	// across all versions of a kind (an SDK invariant), so registering again
	// for each served version is a harmless overwrite. A nil FolderScoped
	// defaults to folder-scoped, matching the SDK contract; folders are
	// namespaced, so cluster kinds opt out.
	folder := (kind.FolderScoped == nil || *kind.FolderScoped) && !clusterScoped
	opts.StorageOptsRegister(gr, apistore.StorageOptions{
		EnableFolderSupport:  folder,
		RequireFolder:        folder,
		DeprecatedInternalID: apistore.DeprecatedID_None,
		Scheme:               opts.Scheme,
	})

	store := &registry.Store{
		NewFunc: func() runtime.Object {
			u := &unstructured.Unstructured{}
			u.SetGroupVersionKind(gvk)
			return u
		},
		NewListFunc: func() runtime.Object {
			u := &unstructured.UnstructuredList{}
			u.SetGroupVersionKind(listGVK)
			return u
		},
		KeyRootFunc:              grafanaregistry.KeyRootFunc(gr),
		KeyFunc:                  keyFunc,
		PredicateFunc:            grafanaregistry.Matcher,
		DefaultQualifiedResource: gr,
		// Reported in discovery so `kubectl get <singular>` and error
		// messages resolve the kind's lowercase name, not just the plural.
		SingularQualifiedResource: schema.GroupResource{Group: gvk.Group, Resource: strings.ToLower(gvk.Kind)},
		TableConvertor:            newKindTableConvertor(gr, gvk, kind),
		CreateStrategy:            wrap,
		UpdateStrategy:            wrap,
		DeleteStrategy:            wrap,
		ResetFieldsStrategy:       wrap,
	}
	wrap.Store = store
	if err := store.CompleteWithOptions(&generic.StoreOptions{
		RESTOptions: opts.OptsGetter,
		AttrFunc:    grafanaregistry.GetAttrs,
	}); err != nil {
		return nil, err
	}
	return wrap, nil
}

// newKindTableConvertor builds table output from the manifest's
// additionalPrinterColumns, mirroring CRD behavior. An invalid column
// definition degrades to the default name+age table rather than failing the
// whole plugin API group.
func newKindTableConvertor(gr schema.GroupResource, gvk schema.GroupVersionKind, kind app.ManifestVersionKind) rest.TableConvertor {
	if len(kind.AdditionalPrinterColumns) == 0 {
		return rest.NewDefaultTableConvertor(gr)
	}
	columns := make([]apiextensionsv1.CustomResourceColumnDefinition, 0, len(kind.AdditionalPrinterColumns))
	for _, col := range kind.AdditionalPrinterColumns {
		c := apiextensionsv1.CustomResourceColumnDefinition{
			Name:        col.Name,
			Type:        col.Type,
			Format:      col.Format,
			Description: col.Description,
			JSONPath:    col.JSONPath,
		}
		if col.Priority != nil {
			c.Priority = *col.Priority
		}
		columns = append(columns, c)
	}
	convertor, err := tableconvertor.New(columns)
	if err != nil {
		logging.DefaultLogger.Error("invalid additionalPrinterColumns; using default table output",
			"gvk", gvk.String(), "error", err)
		return rest.NewDefaultTableConvertor(gr)
	}
	return convertor
}

// NamespaceScoped implements [rest.Scoper]. It must be implemented here: the
// embedded Store's version delegates to its CreateStrategy -- this object --
// so the promoted method would recurse forever.
func (s *kindStore) NamespaceScoped() bool {
	return !s.clusterScoped
}

// GetResetFields implements [rest.ResetFieldsStrategy]: when status is a
// subresource, server-side apply must not track status changes made through
// the main resource.
func (s *kindStore) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	if !s.hasStatus {
		return nil
	}
	return map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.gvk.GroupVersion().String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("status"),
		),
	}
}

// AllowCreateOnUpdate implements [rest.RESTUpdateStrategy].
func (s *kindStore) AllowCreateOnUpdate() bool {
	return false
}

// AllowUnconditionalUpdate implements [rest.RESTUpdateStrategy].
func (s *kindStore) AllowUnconditionalUpdate() bool {
	return false
}

// Canonicalize implements [rest.RESTUpdateStrategy].
func (s *kindStore) Canonicalize(obj runtime.Object) {
	// noop
}

// ObjectKinds implements [runtime.ObjectTyper]. The store only ever handles
// its own kind.
func (s *kindStore) ObjectKinds(runtime.Object) ([]schema.GroupVersionKind, bool, error) {
	return []schema.GroupVersionKind{s.gvk}, false, nil
}

// Recognizes implements [runtime.ObjectTyper].
func (s *kindStore) Recognizes(gvk schema.GroupVersionKind) bool {
	return gvk == s.gvk
}

// PrepareForCreate implements [rest.RESTCreateStrategy]. When status is a
// subresource it cannot be set through the main resource, matching CRDs.
func (s *kindStore) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return
	}
	s.restoreGVK(u)
	if s.hasStatus {
		unstructured.RemoveNestedField(u.Object, "status")
	}
	u.SetGeneration(1)
}

// PrepareForUpdate implements [rest.RESTUpdateStrategy]. When status is a
// subresource, updates through the main resource keep the stored status.
// Unified storage bumps the generation when the remaining fields change.
func (s *kindStore) PrepareForUpdate(ctx context.Context, obj runtime.Object, old runtime.Object) {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return
	}
	s.restoreGVK(u)
	if !s.hasStatus {
		return
	}
	oldU, oldOK := old.(*unstructured.Unstructured)
	if !oldOK {
		return
	}
	if status, found, _ := unstructured.NestedFieldNoCopy(oldU.Object, "status"); found {
		u.Object["status"] = runtime.DeepCopyJSONValue(status)
	} else {
		unstructured.RemoveNestedField(u.Object, "status")
	}
}

// restoreGVK stamps the store's GVK when the object arrives without one.
// Server-side apply hands the strategy the hub-version object, whose GVK was
// cleared by the internal-version conversion; unified storage rejects writes
// it cannot fully qualify, and this store only ever serves a single kind.
func (s *kindStore) restoreGVK(u *unstructured.Unstructured) {
	if u.GroupVersionKind().Empty() {
		u.SetGroupVersionKind(s.gvk)
	}
}

// WarningsOnCreate implements [rest.RESTCreateStrategy].
func (s *kindStore) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	return nil
}

// WarningsOnUpdate implements [rest.RESTUpdateStrategy].
func (s *kindStore) WarningsOnUpdate(ctx context.Context, obj runtime.Object, old runtime.Object) []string {
	return nil
}

// Validate implements [rest.RESTCreateStrategy].
func (s *kindStore) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return s.validateAgainstSchema(obj)
}

// ValidateUpdate implements [rest.RESTUpdateStrategy].
func (s *kindStore) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return s.validateAgainstSchema(obj)
}

func (s *kindStore) validateAgainstSchema(obj runtime.Object) field.ErrorList {
	if s.validator == nil {
		return nil
	}
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil
	}
	return validation.ValidateCustomResource(nil, u.UnstructuredContent(), s.validator)
}
