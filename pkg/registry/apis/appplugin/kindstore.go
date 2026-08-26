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
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// clusterScope is the manifest value for kinds that live outside a namespace.
const clusterScope = "Cluster"

func isFolderScoped(kind app.ManifestVersionKind) bool {
	if kind.Scope == clusterScope {
		return false
	}
	// namespaced resources are folder scoped by default
	return kind.FolderScoped == nil || *kind.FolderScoped
}

// kindStore applies a manifest kind's storage and REST strategies.
type kindStore struct {
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
}

var (
	_ rest.RESTCreateStrategy  = (*kindStore)(nil)
	_ rest.RESTUpdateStrategy  = (*kindStore)(nil)
	_ rest.RESTDeleteStrategy  = (*kindStore)(nil)
	_ rest.ResetFieldsStrategy = (*kindStore)(nil)
)

// newKindStore builds unified storage for one manifest kind.
func newKindStore(
	gvk schema.GroupVersionKind,
	kind app.ManifestVersionKind,
	admission pluginv3.AdmissionServiceClient,
	opts *builder.APIGroupOptions,
	defs map[string]common.OpenAPIDefinition,
) (*kindStore, error) {
	// The manifest loader defaults plural to kind+"s", but a manifest built in
	// code can omit it, and an empty resource name registers an unreachable path.
	if kind.Plural == "" {
		return nil, fmt.Errorf("kind %s is missing a plural name", gvk.Kind)
	}

	gr := schema.GroupResource{Group: gvk.Group, Resource: strings.ToLower(kind.Plural)}
	listGVK := gvk.GroupVersion().WithKind(gvk.Kind + "List")
	clusterScoped := kind.Scope == clusterScope

	keyFunc := grafanaregistry.NamespaceKeyFunc(gr)
	if clusterScoped {
		keyFunc = grafanaregistry.ClusterScopedKeyFunc(gr)
	}

	wrap := &kindStore{
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
		key := kindOpenAPIName(gvk)
		def, found := defs[key]
		if !found {
			return nil, fmt.Errorf("missing expected schema key %s", key)
		}
		wrap.validator = newKindSchemaValidator(def.Schema, defs)
		_, wrap.hasStatus = def.Schema.Properties["status"]
	}

	// Register before CompleteWithOptions resolves this resource.
	folder := isFolderScoped(kind)
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

// newKindTableConvertor adds the manifest's printer columns to table output.
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

// NamespaceScoped avoids recursion through the embedded store's strategy.
func (s *kindStore) NamespaceScoped() bool {
	return !s.clusterScoped
}

// GetResetFields excludes status from main-resource server-side apply.
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

// ObjectKinds implements [runtime.ObjectTyper].
func (s *kindStore) ObjectKinds(runtime.Object) ([]schema.GroupVersionKind, bool, error) {
	return []schema.GroupVersionKind{s.gvk}, false, nil
}

// Recognizes implements [runtime.ObjectTyper].
func (s *kindStore) Recognizes(gvk schema.GroupVersionKind) bool {
	return gvk == s.gvk
}

// PrepareForCreate removes status when it is a subresource.
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

// PrepareForUpdate preserves status when it is a subresource.
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

// restoreGVK restores the GVK cleared by server-side apply's internal conversion.
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
