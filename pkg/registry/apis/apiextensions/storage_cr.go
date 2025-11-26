package apiextensions

import (
	"context"
	"fmt"

	jsonpatch "github.com/evanphx/json-patch"
	"github.com/google/uuid"
	authlib "github.com/grafana/authlib/types"
	apiextensions "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apiextensions-apiserver/pkg/apiserver/validation"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/json"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ rest.StandardStorage = (*customResourceStorage)(nil)
var _ rest.Patcher = (*customResourceStorage)(nil)
var _ rest.Scoper = (*customResourceStorage)(nil)

var (
	internalScheme = runtime.NewScheme()
)

func init() {
	_ = apiextensionsv1.AddToScheme(internalScheme)
	_ = apiextensions.AddToScheme(internalScheme)
}

// customResourceStorage implements REST storage for custom resource instances
// It bypasses the generic registry store and calls unified storage directly
// to properly handle unstructured objects
type customResourceStorage struct {
	storage      storage.Interface // Direct unified storage interface
	crd          *apiextensionsv1.CustomResourceDefinition
	version      string
	gvk          schema.GroupVersionKind
	gvr          schema.GroupVersionResource
	accessClient authlib.AccessClient
	keyFunc      func(ctx context.Context, name string) (string, error)
	keyRootFunc  func(ctx context.Context) string
}

// NewCustomResourceStorage creates storage for a custom resource based on its CRD
func NewCustomResourceStorage(
	crd *apiextensionsv1.CustomResourceDefinition,
	version string,
	scheme *runtime.Scheme,
	optsGetter generic.RESTOptionsGetter,
	accessClient authlib.AccessClient,
	unifiedClient resource.ResourceClient,
) (*customResourceStorage, error) {
	gvk := schema.GroupVersionKind{
		Group:   crd.Spec.Group,
		Version: version,
		Kind:    crd.Spec.Names.Kind,
	}

	gvr := schema.GroupVersionResource{
		Group:    crd.Spec.Group,
		Version:  version,
		Resource: crd.Spec.Names.Plural,
	}

	// Register the custom resource type as unstructured
	scheme.AddKnownTypeWithName(gvk, &unstructured.Unstructured{})
	listGVK := gvk
	listGVK.Kind = crd.Spec.Names.ListKind
	scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})

	// Create resource info for this custom resource
	resourceInfo := utils.NewResourceInfo(
		crd.Spec.Group,
		version,
		crd.Spec.Names.Plural,
		crd.Spec.Names.Singular,
		crd.Spec.Names.Kind,
		func() runtime.Object {
			u := &unstructured.Unstructured{}
			u.SetGroupVersionKind(gvk)
			return u
		},
		func() runtime.Object {
			ul := &unstructured.UnstructuredList{}
			ul.SetGroupVersionKind(schema.GroupVersionKind{
				Group:   crd.Spec.Group,
				Version: version,
				Kind:    crd.Spec.Names.ListKind,
			})
			return ul
		},
		utils.TableColumns{},
	)

	// Make it cluster-scoped if needed
	if crd.Spec.Scope == apiextensionsv1.ClusterScoped {
		resourceInfo = resourceInfo.WithClusterScope()
	}

	// Register storage options
	if restOptGetter, ok := optsGetter.(*apistore.RESTOptionsGetter); ok {
		restOptGetter.RegisterOptions(
			gvr.GroupResource(),
			apistore.StorageOptions{},
		)
	}

	// We need this to set the codec below
	gr := gvr.GroupResource()
	opts, err := optsGetter.GetRESTOptions(gr, &unstructured.Unstructured{})
	if err != nil {
		return nil, fmt.Errorf("failed to get REST options: %w", err)
	}

	// This codec can handle any dynamic type without compile-time registration
	// Without explicitly defined we get this error:
	// https://github.com/kubernetes/apimachinery/blob/5a348c53eef0072c40ddf00a45ace423c2790f2a/pkg/runtime/error.go#L52
	opts.StorageConfig.Codec = unstructured.UnstructuredJSONScheme

	// Get the ConfigForResource
	config := opts.StorageConfig.ForResource(gr)

	// Create key functions for storage
	keyFunc := func(obj runtime.Object) (string, error) {
		accessor, err := utils.MetaAccessor(obj)
		if err != nil {
			return "", err
		}
		name := accessor.GetName()
		ns := accessor.GetNamespace()

		key := &grafanaregistry.Key{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: ns,
			Name:      name,
		}
		return key.String(), nil
	}

	keyParser := func(key string) (*resourcepb.ResourceKey, error) {
		k, err := grafanaregistry.ParseKey(key)
		if err != nil {
			return nil, err
		}
		return &resourcepb.ResourceKey{
			Namespace: k.Namespace,
			Group:     k.Group,
			Resource:  k.Resource,
			Name:      k.Name,
		}, nil
	}

	// Create the actual storage using apistore.NewStorage
	underlyingStorage, _, err := apistore.NewStorage(
		config,
		unifiedClient,
		keyFunc,
		keyParser,
		func() runtime.Object { return &unstructured.Unstructured{} },
		func() runtime.Object { return &unstructured.UnstructuredList{} },
		grafanaregistry.GetAttrs,
		nil, // trigger
		nil, // indexers
		nil, // configProvider
		apistore.StorageOptions{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create storage: %w", err)
	}

	return &customResourceStorage{
		storage:      underlyingStorage,
		crd:          crd,
		version:      version,
		gvk:          gvk,
		gvr:          gvr,
		accessClient: accessClient,
		keyFunc:      grafanaregistry.NamespaceKeyFunc(gr),
		keyRootFunc:  grafanaregistry.KeyRootFunc(gr),
	}, nil
}

// NamespaceScoped returns whether this custom resource is namespaced
func (s *customResourceStorage) NamespaceScoped() bool {
	return s.crd.Spec.Scope == apiextensionsv1.NamespaceScoped
}

// New returns a new instance of the custom resource
func (s *customResourceStorage) New() runtime.Object {
	return &unstructured.Unstructured{}
}

// NewList returns a new list instance
func (s *customResourceStorage) NewList() runtime.Object {
	return &unstructured.UnstructuredList{}
}

// getValidator returns a validator for the custom resource
func (s *customResourceStorage) getValidator() (validation.SchemaValidator, error) {
	// Find the version we are serving
	var version *apiextensionsv1.CustomResourceDefinitionVersion
	for i := range s.crd.Spec.Versions {
		v := &s.crd.Spec.Versions[i]
		if v.Name == s.version {
			version = v
			break
		}
	}

	// If no schema is defined, we can't validate
	if version == nil || version.Schema == nil || version.Schema.OpenAPIV3Schema == nil {
		return nil, nil
	}

	// Convert v1 schema to internal schema
	internalSchema := &apiextensions.JSONSchemaProps{}
	if err := internalScheme.Convert(version.Schema.OpenAPIV3Schema, internalSchema, nil); err != nil {
		return nil, fmt.Errorf("failed to convert schema to internal version: %w", err)
	}

	// Create validator
	val, _, err := validation.NewSchemaValidator(internalSchema)
	return val, err
}

// Create validates and creates a custom resource instance
func (s *customResourceStorage) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	// Ensure the object is unstructured as it is a "custom" CRD
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, apierrors.NewBadRequest("object must be unstructured")
	}

	// Validate GVK matches the CRD
	// Could it arrive here without a match from storage match failure?
	objGVK := u.GroupVersionKind()
	if objGVK.Group != s.gvk.Group || objGVK.Version != s.gvk.Version || objGVK.Kind != s.gvk.Kind {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("object GVK %s does not match CRD GVK %s", objGVK.String(), s.gvk.String()),
		)
	}

	// Set defaults if not present
	if u.GetNamespace() == "" && s.NamespaceScoped() {
		u.SetNamespace("default")
	}
	if u.GetName() == "" {
		u.SetName(uuid.New().String())
	}

	// Ensure GVK is set
	u.SetGroupVersionKind(s.gvk)

	// Run validation if provided
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	// Validate against OpenAPI schema
	validator, err := s.getValidator()
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get validator: %v", err))
	}
	if validator != nil {
		if errs := validation.ValidateCustomResource(field.NewPath(""), u.UnstructuredContent(), validator); len(errs) > 0 {
			return nil, apierrors.NewInvalid(s.gvk.GroupKind(), u.GetName(), errs)
		}
	}

	// Generate storage key
	key, err := s.keyFunc(ctx, u.GetName())
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}

	if options != nil && len(options.DryRun) > 0 {
		return u, nil
	}

	// Create the object in storage
	// TODO(@konsalex): Figure out if this ttl should be (!=0)
	out := &unstructured.Unstructured{}
	if err := s.storage.Create(ctx, key, obj, out, 0); err != nil {
		return nil, err
	}

	return out, nil
}

// Get retrieves a custom resource instance by name
func (s *customResourceStorage) Get(
	ctx context.Context,
	name string,
	options *metav1.GetOptions,
) (runtime.Object, error) {
	key, err := s.keyFunc(ctx, name)
	if err != nil {
		return nil, err
	}

	out := &unstructured.Unstructured{}
	getOpts := storage.GetOptions{
		IgnoreNotFound:  false,
		ResourceVersion: "",
	}
	if options != nil {
		getOpts.ResourceVersion = options.ResourceVersion
	}
	if err := s.storage.Get(ctx, key, getOpts, out); err != nil {
		return nil, err
	}

	return out, nil
}

// List retrieves a list of custom resource instances
func (s *customResourceStorage) List(
	ctx context.Context,
	options *metainternalversion.ListOptions,
) (runtime.Object, error) {
	// Create an empty list to populate
	listObj := &unstructured.UnstructuredList{}
	listObj.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   s.gvk.Group,
		Version: s.gvk.Version,
		Kind:    s.crd.Spec.Names.ListKind,
	})

	// Handle nil options
	if options == nil {
		options = &metainternalversion.ListOptions{}
	}

	// Convert metainternalversion.ListOptions to storage.ListOptions
	listOpts := storage.ListOptions{
		ResourceVersion:      options.ResourceVersion,
		ResourceVersionMatch: options.ResourceVersionMatch,
		Predicate:            storage.Everything,
	}

	if options.LabelSelector != nil {
		listOpts.Predicate.Label = options.LabelSelector
	}
	if options.FieldSelector != nil {
		listOpts.Predicate.Field = options.FieldSelector
	}

	// Get the key prefix for listing
	keyPrefix := s.keyRootFunc(ctx)

	// Call the underlying storage List/GetList
	if err := s.storage.GetList(ctx, keyPrefix, listOpts, listObj); err != nil {
		return nil, err
	}

	return listObj, nil
}

// Delete removes a custom resource instance
func (s *customResourceStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	key, err := s.keyFunc(ctx, name)
	if err != nil {
		return nil, false, err
	}

	out := &unstructured.Unstructured{}
	preconditions := &storage.Preconditions{}
	if options != nil && options.Preconditions != nil {
		if options.Preconditions.UID != nil {
			preconditions.UID = options.Preconditions.UID
		}
		if options.Preconditions.ResourceVersion != nil {
			preconditions.ResourceVersion = options.Preconditions.ResourceVersion
		}
	}

	validateFunc := func(ctx context.Context, obj runtime.Object) error {
		if deleteValidation != nil {
			return deleteValidation(ctx, obj)
		}
		return nil
	}

	if options != nil && len(options.DryRun) > 0 {
		// We need to fetch it to make sure it exists and to return it
		if err := s.storage.Get(ctx, key, storage.GetOptions{}, out); err != nil {
			return nil, false, err
		}
		if err := validateFunc(ctx, out); err != nil {
			return nil, false, err
		}
		return out, true, nil
	}

	if err := s.storage.Delete(ctx, key, out, preconditions, validateFunc, out, storage.DeleteOptions{}); err != nil {
		return nil, false, err
	}

	return out, true, nil
}

// Update updates a custom resource instance
func (s *customResourceStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	key, err := s.keyFunc(ctx, name)
	if err != nil {
		return nil, false, err
	}

	// Get the existing object
	existingObj := &unstructured.Unstructured{}
	existingObj.SetGroupVersionKind(s.gvk)

	err = s.storage.Get(ctx, key, storage.GetOptions{}, existingObj)
	if err != nil {
		if storage.IsNotFound(err) {
			if !forceAllowCreate {
				return nil, false, apierrors.NewNotFound(s.gvr.GroupResource(), name)
			}
			// If forceAllowCreate is true, treat as a create
			// and not as an update
			newObj, err := objInfo.UpdatedObject(ctx, nil)
			if err != nil {
				return nil, false, err
			}

			if createValidation != nil {
				if err := createValidation(ctx, newObj); err != nil {
					return nil, false, err
				}
			}

			// Call Create internally
			created, err := s.Create(ctx, newObj, nil, nil)
			if err != nil {
				return nil, false, err
			}
			return created, true, nil
		}
		return nil, false, err
	}

	// Get the updated object
	updatedObj, err := objInfo.UpdatedObject(ctx, existingObj)
	if err != nil {
		return nil, false, err
	}

	// Validate the update
	if updateValidation != nil {
		if err := updateValidation(ctx, updatedObj, existingObj); err != nil {
			return nil, false, err
		}
	}

	// Ensure it's an unstructured object
	updatedUnstructured, ok := updatedObj.(*unstructured.Unstructured)
	if !ok {
		return nil, false, fmt.Errorf("updated object is not unstructured")
	}

	// Set the GVK
	updatedUnstructured.SetGroupVersionKind(s.gvk)

	// Ensure namespace and name are set correctly
	if s.NamespaceScoped() {
		ns := updatedUnstructured.GetNamespace()
		if ns == "" {
			updatedUnstructured.SetNamespace("default")
		}
	}
	updatedUnstructured.SetName(name)

	// Validate against OpenAPI schema
	validator, err := s.getValidator()
	if err != nil {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("failed to get validator: %v", err))
	}
	if validator != nil {
		// We need the old object as interface{}
		if errs := validation.ValidateCustomResourceUpdate(field.NewPath(""), updatedUnstructured.UnstructuredContent(), existingObj.UnstructuredContent(), validator); len(errs) > 0 {
			return nil, false, apierrors.NewInvalid(s.gvk.GroupKind(), name, errs)
		}
	}

	// Use GuaranteedUpdate for optimistic concurrency control
	out := &unstructured.Unstructured{}
	out.SetGroupVersionKind(s.gvk)

	updateFunc := func(input runtime.Object, respMeta storage.ResponseMeta) (runtime.Object, *uint64, error) {
		// Return the updated object
		return updatedUnstructured, nil, nil
	}

	if options != nil && len(options.DryRun) > 0 {
		return updatedUnstructured, false, nil
	}

	preconditions := &storage.Preconditions{}

	// We explicitly ignore the not-found, as we checked before proceeding
	err = s.storage.GuaranteedUpdate(ctx, key, out, true, preconditions, updateFunc, out)
	if err != nil {
		return nil, false, err
	}

	return out, false, nil
}

// Patch patches a custom resource instance
func (s *customResourceStorage) Patch(
	ctx context.Context,
	name string,
	patchType types.PatchType,
	patchBytes []byte,
	options *metav1.PatchOptions,
	subresources ...string,
) (runtime.Object, error) {
	key, err := s.keyFunc(ctx, name)
	if err != nil {
		return nil, err
	}

	existingObj := &unstructured.Unstructured{}
	existingObj.SetGroupVersionKind(s.gvk)

	err = s.storage.Get(ctx, key, storage.GetOptions{}, existingObj)
	if err != nil {
		if storage.IsNotFound(err) {
			return nil, apierrors.NewNotFound(s.gvr.GroupResource(), name)
		}
		return nil, err
	}

	existingJSON, err := json.Marshal(existingObj.Object)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal existing object: %w", err)
	}

	var patchedJSON []byte

	switch patchType {
	case types.JSONPatchType:
		patch, err := jsonpatch.DecodePatch(patchBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to decode JSON patch: %w", err)
		}
		patchedJSON, err = patch.Apply(existingJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to apply JSON patch: %w", err)
		}

	case types.MergePatchType:
		patchedJSON, err = jsonpatch.MergePatch(existingJSON, patchBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to apply merge patch: %w", err)
		}

	case types.StrategicMergePatchType:
		// Kubernetes Strategic Merge Patch
		// For unstructured objects, strategic merge patch behaves like merge patch
		// because we don't have a Go struct to define merge strategies
		// TODO(@konsalex): Clarify is we need to even support this by falling-back to merge patch, or just return an error to inform clients
		// patchedJSON, err = strategicpatch.StrategicMergePatch(existingJSON, patchBytes, &unstructured.Unstructured{})

		// Fallback to merge patch if strategic merge fails
		patchedJSON, err = jsonpatch.MergePatch(existingJSON, patchBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to apply patch: %w", err)
		}

	default:
		return nil, fmt.Errorf("unsupported patch type: %s", patchType)
	}

	// Unmarshal the patched JSON into an unstructured object
	patchedObj := &unstructured.Unstructured{}
	if err := json.Unmarshal(patchedJSON, &patchedObj.Object); err != nil {
		return nil, fmt.Errorf("failed to unmarshal patched object: %w", err)
	}

	// Set the GVK
	patchedObj.SetGroupVersionKind(s.gvk)

	// Ensure namespace and name are set correctly
	if s.NamespaceScoped() {
		ns := patchedObj.GetNamespace()
		if ns == "" {
			patchedObj.SetNamespace(existingObj.GetNamespace())
		}
	}
	patchedObj.SetName(name)

	// Validate against OpenAPI schema
	validator, err := s.getValidator()
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("failed to get validator: %v", err))
	}
	if validator != nil {
		// We need the old object as interface{}
		if errs := validation.ValidateCustomResourceUpdate(field.NewPath(""), patchedObj.UnstructuredContent(), existingObj.UnstructuredContent(), validator); len(errs) > 0 {
			return nil, apierrors.NewInvalid(s.gvk.GroupKind(), name, errs)
		}
	}

	// Use GuaranteedUpdate to save the patched object
	out := &unstructured.Unstructured{}
	out.SetGroupVersionKind(s.gvk)

	updateFunc := func(input runtime.Object, respMeta storage.ResponseMeta) (runtime.Object, *uint64, error) {
		return patchedObj, nil, nil
	}

	preconditions := &storage.Preconditions{}
	if options != nil && options.DryRun != nil && len(options.DryRun) > 0 {
		fmt.Printf("  - Dry run mode\n")
	}

	err = s.storage.GuaranteedUpdate(ctx, key, out, true, preconditions, updateFunc, out)
	if err != nil {
		return nil, err
	}

	return out, nil
}

// DeleteCollection deletes a collection of custom resources
func (s *customResourceStorage) DeleteCollection(
	ctx context.Context,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
	listOptions *metainternalversion.ListOptions,
) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(s.gvr.GroupResource(), "deletecollection")
}

// Watch returns a watch interface for custom resources
func (s *customResourceStorage) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	return nil, apierrors.NewMethodNotSupported(s.gvr.GroupResource(), "watch")
}

// ConvertToTable converts to a table for kubectl
func (s *customResourceStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return nil, apierrors.NewMethodNotSupported(s.gvr.GroupResource(), "table")
}

// Destroy cleans up resources
func (s *customResourceStorage) Destroy() {
	// Nothing to clean up for direct storage
}
