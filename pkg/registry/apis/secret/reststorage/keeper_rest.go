package reststorage

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var (
	_ rest.Scoper               = (*KeeperRest)(nil)
	_ rest.SingularNameProvider = (*KeeperRest)(nil)
	_ rest.Getter               = (*KeeperRest)(nil)
	_ rest.Lister               = (*KeeperRest)(nil)
	_ rest.Storage              = (*KeeperRest)(nil)
	_ rest.Creater              = (*KeeperRest)(nil)
	_ rest.Updater              = (*KeeperRest)(nil)
	_ rest.GracefulDeleter      = (*KeeperRest)(nil)
)

// KeeperRest is an implementation of CRUDL operations on a `keeper` backed by TODO.
type KeeperRest struct {
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// NewKeeperRest is a returns a constructed `*KeeperRest`.
func NewKeeperRest(resource utils.ResourceInfo) *KeeperRest {
	return &KeeperRest{resource, resource.TableConverter()}
}

// New returns an empty `*Keeper` that is used by the `Create` method.
func (s *KeeperRest) New() runtime.Object {
	return s.resource.NewFunc()
}

// Destroy is called when? [TODO]
func (s *KeeperRest) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (s *KeeperRest) NamespaceScoped() bool {
	return true
}

// GetSingularName is used by `kubectl` discovery to have singular name representation of resources.
func (s *KeeperRest) GetSingularName() string {
	return s.resource.GetSingularName()
}

// NewList returns an empty `*KeeperList` that is used by the `List` method.
func (s *KeeperRest) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

// ConvertToTable is used by Kubernetes and converts objects to `metav1.Table`.
func (s *KeeperRest) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// List calls the inner `store` (persistence) and returns a list of `Keepers` within a `namespace` filtered by the `options`.
func (s *KeeperRest) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: implement me
	return nil, nil
}

// Get calls the inner `store` (persistence) and returns a `Keeper` by `name`. It will NOT return the decrypted `value`.
func (s *KeeperRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// TODO: implement me
	return nil, nil
}

// Create a new `Keeper`. Does some validation and allows empty `name` (generated).
func (s *KeeperRest) Create(
	ctx context.Context,
	obj runtime.Object,

	// TODO: How to define this function? perhaps would be useful to keep all validation here.
	createValidation rest.ValidateObjectFunc,

	// TODO: How can we use these options? Looks useful. `dryRun` for dev as well.
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	// TODO: implement creation in storage
	return nil, nil
}

// Update a `Keeper`'s `value`. The second return parameter indicates whether the resource was newly created.
func (s *KeeperRest) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,

	// This lets a `Keeper` be created when an `Update` is called.
	// TODO: Can we control this toggle or is this set by the client? We could always ignore it.
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	// TODO: implement update in storage
	return nil, false, nil
}

// Delete calls the inner `store` (persistence) in order to delete the `Keeper`.
// The second return parameter `bool` indicates whether the delete was intant or not. It always is for `Keepers`.
func (s *KeeperRest) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// TODO: Make sure the second parameter is always `true` when `err == nil`.
	// Even when there is nothing to delete, because this is a `Keeper` and
	// we don't want to first do a `Get` to check whether the secret exists or not.

	// TODO: implement delete in storage
	return nil, false, nil
}
