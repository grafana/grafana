package kindstore

import (
	"context"
	"fmt"
	"strings"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	structuralschema "k8s.io/apiextensions-apiserver/pkg/apiserver/schema"
	"k8s.io/apiextensions-apiserver/pkg/apiserver/validation"
	"k8s.io/apiextensions-apiserver/pkg/registry/customresource/tableconvertor"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/managedfields"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
	"k8s.io/kube-openapi/pkg/common"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// ClusterScope is the manifest value for kinds that live outside a namespace.
const ClusterScope = "Cluster"

// Options is what building a kind's storage needs from the API group installing
// it. Named here rather than taking the installer's own options type, so this
// package depends on nothing it does not use.
type Options struct {
	// Scheme the kind is registered in.
	Scheme *runtime.Scheme
	// OptsGetter resolves the backing storage.
	OptsGetter generic.RESTOptionsGetter
	// StorageOptsRegister declares a resource's storage options, and has to be
	// called before OptsGetter resolves that resource.
	StorageOptsRegister apistore.StorageOptionsRegister
}

func IsFolderScoped(kind app.ManifestVersionKind) bool {
	if kind.Scope == ClusterScope {
		return false
	}
	// namespaced resources are folder scoped by default
	return kind.FolderScoped == nil || *kind.FolderScoped
}

// Store applies a manifest kind's storage and REST strategies.
type Store struct {
	*registry.Store
	names.NameGenerator

	gvk           schema.GroupVersionKind
	clusterScoped bool

	// used for admission hooks
	admission pluginv3.AdmissionServiceClient

	// mutation and validation are the operations the manifest declared each
	// admission capability for. Nil when the kind declares none.
	mutation   admissionOps
	validation admissionOps

	// hasStatus prevents main-resource writes from changing status.
	hasStatus bool

	// validator is nil when the kind has no schema.
	validator validation.SchemaValidator

	// structural drives pruning and defaulting. Nil when the kind has no schema,
	// or declares one apiextensions could not serve as a CRD either.
	structural *structuralschema.Structural

	// fieldManager tracks managedFields on create, which the generic create
	// handler cannot do for an unstructured kind. See newFieldManager.
	fieldManager *managedfields.FieldManager
}

var (
	_ rest.RESTCreateStrategy  = (*Store)(nil)
	_ rest.RESTUpdateStrategy  = (*Store)(nil)
	_ rest.RESTDeleteStrategy  = (*Store)(nil)
	_ rest.ResetFieldsStrategy = (*Store)(nil)
)

// New builds unified storage for one manifest kind.
func New(
	gvk schema.GroupVersionKind,
	kind app.ManifestVersionKind,
	admission pluginv3.AdmissionServiceClient,
	opts Options,
	defs map[string]common.OpenAPIDefinition,
) (*Store, error) {
	// The manifest loader defaults plural to kind+"s", but a manifest built in
	// code can omit it, and an empty resource name registers an unreachable path.
	if kind.Plural == "" {
		return nil, fmt.Errorf("kind %s is missing a plural name", gvk.Kind)
	}

	gr := schema.GroupResource{Group: gvk.Group, Resource: strings.ToLower(kind.Plural)}
	listGVK := gvk.GroupVersion().WithKind(gvk.Kind + "List")
	clusterScoped := kind.Scope == ClusterScope

	keyFunc := grafanaregistry.NamespaceKeyFunc(gr)
	if clusterScoped {
		keyFunc = grafanaregistry.ClusterScopedKeyFunc(gr)
	}

	wrap := &Store{
		NameGenerator: names.SimpleNameGenerator,
		gvk:           gvk,
		clusterScoped: clusterScoped,
		admission:     admission,
	}

	if kind.Admission != nil {
		if kind.Admission.SupportsAnyMutation() {
			wrap.mutation = newAdmissionOps(kind.Admission.Mutation.Operations)
		}
		if kind.Admission.SupportsAnyValidation() {
			wrap.validation = newAdmissionOps(kind.Admission.Validation.Operations)
		}
		// A declared hook fails the request when it cannot be reached, so a missing
		// client would reject every write. Surface it at startup instead.
		if admission == nil && (wrap.mutation != nil || wrap.validation != nil) {
			return nil, fmt.Errorf("kind %s declares admission capabilities but has no plugin client", gvk.Kind)
		}
	}

	// A kind may legally omit its schema; serve it without body validation.
	if kind.Schema != nil {
		key := OpenAPIName(gvk)
		def, found := defs[key]
		if !found {
			return nil, fmt.Errorf("missing expected schema key %s", key)
		}
		wrap.validator = newSchemaValidator(def.Schema, defs)
		_, wrap.hasStatus = def.Schema.Properties["status"]

		structural, err := newStructuralSchema(def.Schema, defs)
		if err != nil {
			logging.DefaultLogger.Warn("manifest kind schema is not structural; the kind is served without pruning or defaulting",
				"gvk", gvk.String(), "error", err)
		} else {
			wrap.structural = structural
		}
	}

	// GetResetFields needs hasStatus, which the schema block above resolves.
	fieldManager, err := newFieldManager(gvk, wrap.GetResetFields())
	if err != nil {
		return nil, fmt.Errorf("kind %s: %w", gvk.Kind, err)
	}
	wrap.fieldManager = fieldManager

	// Register before CompleteWithOptions resolves this resource.
	folder := IsFolderScoped(kind)
	opts.StorageOptsRegister(gr, apistore.StorageOptions{
		EnableFolderSupport:  folder,
		RequireFolder:        folder, // always true for manifest based kinds with folder support
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
		// Used by discovery and error messages.
		SingularQualifiedResource: schema.GroupResource{Group: gvk.Group, Resource: strings.ToLower(gvk.Kind)},
		TableConvertor:            newTableConvertor(gr, gvk, kind),
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

// newTableConvertor adds the manifest's printer columns to table output.
func newTableConvertor(gr schema.GroupResource, gvk schema.GroupVersionKind, kind app.ManifestVersionKind) rest.TableConvertor {
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

// HasStatus reports whether the kind serves a status subresource, which is what
// decides whether [NewStatusStore] has anything to serve.
func (s *Store) HasStatus() bool {
	return s.hasStatus
}

// NamespaceScoped avoids recursion through the embedded store's strategy.
func (s *Store) NamespaceScoped() bool {
	return !s.clusterScoped
}

// GetResetFields excludes status from main-resource server-side apply.
func (s *Store) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
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
func (s *Store) AllowCreateOnUpdate() bool {
	return false
}

// AllowUnconditionalUpdate implements [rest.RESTUpdateStrategy].
func (s *Store) AllowUnconditionalUpdate() bool {
	return false
}

// Canonicalize implements [rest.RESTUpdateStrategy].
func (s *Store) Canonicalize(obj runtime.Object) {
	// noop
}

// ObjectKinds implements [runtime.ObjectTyper].
func (s *Store) ObjectKinds(runtime.Object) ([]schema.GroupVersionKind, bool, error) {
	return []schema.GroupVersionKind{s.gvk}, false, nil
}

// Recognizes implements [runtime.ObjectTyper].
func (s *Store) Recognizes(gvk schema.GroupVersionKind) bool {
	return gvk == s.gvk
}

// Create fills in the managedFields the generic create handler could not.
//
// That handler diffs the submitted object against an empty live object it asks
// the scheme for, which for an unstructured kind carries no GVK, so the diff
// fails and it strips managedFields off the object it hands us. Redo the diff
// here, against a live object that has its GVK. See newFieldManager.
func (s *Store) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return s.Store.Create(ctx, s.trackManagedFields(obj, options), createValidation, options)
}

func (s *Store) trackManagedFields(obj runtime.Object, options *metav1.CreateOptions) runtime.Object {
	if _, ok := obj.(*unstructured.Unstructured); !ok {
		return obj
	}
	manager := defaultFieldManager
	if options != nil && options.FieldManager != "" {
		manager = options.FieldManager
	}
	live := &unstructured.Unstructured{}
	live.SetGroupVersionKind(s.gvk)
	// UpdateNoErrors clears managedFields rather than failing the write.
	return s.fieldManager.UpdateNoErrors(live, obj, manager)
}

// PrepareForCreate removes status when it is a subresource.
func (s *Store) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return
	}
	s.restoreGVK(u)
	s.pruneAndDefault(u)
	if s.hasStatus {
		unstructured.RemoveNestedField(u.Object, "status")
	}
	u.SetGeneration(1)
}

// PrepareForUpdate preserves status when it is a subresource.
func (s *Store) PrepareForUpdate(ctx context.Context, obj runtime.Object, old runtime.Object) {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return
	}
	s.restoreGVK(u)
	s.pruneAndDefault(u)
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

// restoreGVK restores the GVK cleared by server-side apply's internal conversion.
func (s *Store) restoreGVK(u *unstructured.Unstructured) {
	if u.GroupVersionKind().Empty() {
		u.SetGroupVersionKind(s.gvk)
	}
}

// WarningsOnCreate implements [rest.RESTCreateStrategy].
func (s *Store) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	return nil
}

// WarningsOnUpdate implements [rest.RESTUpdateStrategy].
func (s *Store) WarningsOnUpdate(ctx context.Context, obj runtime.Object, old runtime.Object) []string {
	return nil
}

// Validate implements [rest.RESTCreateStrategy].
func (s *Store) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return s.validateAgainstSchema(obj)
}

// ValidateUpdate implements [rest.RESTUpdateStrategy].
func (s *Store) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return s.validateAgainstSchema(obj)
}

func (s *Store) validateAgainstSchema(obj runtime.Object) field.ErrorList {
	if s.validator == nil {
		return nil
	}
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil
	}
	return validation.ValidateCustomResource(nil, u.UnstructuredContent(), s.validator)
}

// NewStatusStore serves a kind's status subresource.
//
// It is not [grafanaregistry.NewRegistryStatusStore]: that store's strategy
// writes whatever spec the request carried and validates nothing, so a caller
// holding only status access could rewrite the spec through it, and could store
// a spec the manifest schema rejects.
func NewStatusStore(s *Store) *grafanaregistry.StatusREST {
	return grafanaregistry.NewStatusREST(s.Store, &statusStrategy{Store: s})
}

// statusStrategy restricts a write to the status subresource to status.
// Everything else -- schema validation, scope, naming -- is the kind's own.
type statusStrategy struct {
	*Store
}

var _ rest.UpdateResetFieldsStrategy = (*statusStrategy)(nil)

// GetResetFields keeps the status manager from owning fields it cannot write.
func (s *statusStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.gvk.GroupVersion().String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}
}

// PrepareForUpdate restores everything a status write may not change, so only
// the incoming status survives.
func (s *statusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return
	}
	s.restoreGVK(u)
	s.pruneAndDefault(u)
	oldU, ok := old.(*unstructured.Unstructured)
	if !ok {
		return
	}
	if spec, found, _ := unstructured.NestedFieldNoCopy(oldU.Object, "spec"); found {
		u.Object["spec"] = runtime.DeepCopyJSONValue(spec)
	} else {
		unstructured.RemoveNestedField(u.Object, "spec")
	}
	// Mirrors the generic status strategy: the metadata a status write carries
	// is whatever the caller read, not an edit it is entitled to make.
	u.SetLabels(oldU.GetLabels())
	u.SetAnnotations(oldU.GetAnnotations())
	u.SetFinalizers(oldU.GetFinalizers())
	u.SetOwnerReferences(oldU.GetOwnerReferences())
}
