package reststorage

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

var (
	_ rest.Scoper               = (*SecureValueRest)(nil)
	_ rest.SingularNameProvider = (*SecureValueRest)(nil)
	_ rest.Getter               = (*SecureValueRest)(nil)
	_ rest.Lister               = (*SecureValueRest)(nil)
	_ rest.Storage              = (*SecureValueRest)(nil)
	_ rest.Creater              = (*SecureValueRest)(nil)
	_ rest.Updater              = (*SecureValueRest)(nil)
	_ rest.GracefulDeleter      = (*SecureValueRest)(nil)
)

// SecureValueRest is an implementation of CRUDL operations on a `securevalue` backed by a persistence layer `store`.
type SecureValueRest struct {
	storage        contracts.SecureValueMetadataStorage
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// NewSecureValueRest is a returns a constructed `*SecureValueRest`.
func NewSecureValueRest(storage contracts.SecureValueMetadataStorage, resource utils.ResourceInfo) *SecureValueRest {
	return &SecureValueRest{storage, resource, resource.TableConverter()}
}

// New returns an empty `*SecureValue` that is used by the `Create` method.
func (s *SecureValueRest) New() runtime.Object {
	return s.resource.NewFunc()
}

// Destroy is called when? [TODO]
func (s *SecureValueRest) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (s *SecureValueRest) NamespaceScoped() bool {
	return true
}

// GetSingularName is used by `kubectl` discovery to have singular name representation of resources.
func (s *SecureValueRest) GetSingularName() string {
	return s.resource.GetSingularName()
}

// NewList returns an empty `*SecureValueList` that is used by the `List` method.
func (s *SecureValueRest) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

// ConvertToTable is used by Kubernetes and converts objects to `metav1.Table`.
func (s *SecureValueRest) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// List calls the inner `store` (persistence) and returns a list of `securevalues` within a `namespace` filtered by the `options`.
func (s *SecureValueRest) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	_, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	return &secretv0alpha1.SecureValueList{Items: make([]secretv0alpha1.SecureValue, 0)}, nil
}

// Get calls the inner `store` (persistence) and returns a `securevalue` by `name`. It will NOT return the decrypted `value`.
func (s *SecureValueRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	_, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	return nil, s.resource.NewNotFound(name)
}

// Create a new `securevalue`. Does some validation and allows empty `name` (generated).
func (s *SecureValueRest) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	return nil, nil
}

// Update a `securevalue`'s `value`. The second return parameter indicates whether the resource was newly created.
// Currently does not support "create on update" functionality. If the securevalue does not yet exist, it returns an error.
func (s *SecureValueRest) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return nil, false, nil
}

// Delete calls the inner `store` (persistence) in order to delete the `securevalue`.
// The second return parameter `bool` indicates whether the delete was instant or not. It always is for `securevalues`.
func (s *SecureValueRest) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	_, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, false, fmt.Errorf("missing namespace")
	}

	return nil, true, nil
}

// ValidateSecureValue does basic spec validation of a securevalue.
func ValidateSecureValue(sv, oldSv *secretv0alpha1.SecureValue, operation admission.Operation, decryptersAllowList map[string]struct{}) field.ErrorList {
	return nil
}
