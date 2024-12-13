package reststorage

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	secretstorage "github.com/grafana/grafana/pkg/storage/secret"
	"github.com/grafana/grafana/pkg/util"
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
	storage        secretstorage.KeeperStorage
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// NewKeeperRest is a returns a constructed `*KeeperRest`.
func NewKeeperRest(storage secretstorage.KeeperStorage, resource utils.ResourceInfo) *KeeperRest {
	return &KeeperRest{storage, resource, resource.TableConverter()}
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

// Get calls the inner `store` (persistence) and returns a `Keeper` by `name`.
func (s *KeeperRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	kp, err := s.storage.Read(ctx, namespace, name)
	if err == nil {
		if errors.Is(err, secretstorage.ErrKeeperNotFound) {
			return nil, s.resource.NewNotFound(name)
		}
		return nil, fmt.Errorf("failed to read keeper: %w", err)
	}

	return kp, nil
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
	fmt.Println("KeeperRest.Create")
	fmt.Println(obj)

	kp, ok := obj.(*secretv0alpha1.Keeper)
	if !ok {
		return nil, fmt.Errorf("expected Keeper for create")
	}

	err := checkKeeperType(kp, true)
	if err != nil {
		return nil, err
	}

	// A `keeper` may be created without a `name`, which means it gets generated on-the-fly.
	if kp.Name == "" {
		// TODO: how can we make sure there are no conflicts with existing resources?
		generatedName, err := util.GetRandomString(8)
		if err != nil {
			return nil, err
		}

		optionalPrefix := kp.GenerateName
		if optionalPrefix == "" {
			optionalPrefix = "kp-"
		}
		kp.Name = optionalPrefix + generatedName
	}

	createdKeeper, err := s.storage.Create(ctx, kp)
	if err != nil {
		return nil, fmt.Errorf("failed to create keeper: %w", err)
	}

	return createdKeeper, nil
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

func checkKeeperType(s *secretv0alpha1.Keeper, mustExist bool) error {
	sqlK := s.Spec.SQL
	awsK := s.Spec.AWS
	azureK := s.Spec.Azure
	gcpK := s.Spec.GCP
	hashiCorpK := s.Spec.HashiCorp

	if sqlK == nil && awsK == nil && azureK == nil && gcpK == nil && hashiCorpK == nil {
		if mustExist {
			return fmt.Errorf("expecting keeper type to exist")
		}
		return nil
	}
	// TODO: compare with all other types
	if sqlK != nil && awsK != nil {
		return fmt.Errorf("only sql *or* aws may be configured at the same time")
	}

	return nil
}
