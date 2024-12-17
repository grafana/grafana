package reststorage

import (
	"context"
	"errors"
	"fmt"
	"reflect"

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
	namespace := request.NamespaceValue(ctx)

	keepersList, err := s.storage.List(ctx, namespace, options)
	if err != nil {
		return nil, fmt.Errorf("failed to list keepers: %w", err)
	}

	return keepersList, nil
}

// Get calls the inner `store` (persistence) and returns a `Keeper` by `name`.
func (s *KeeperRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	kp, err := s.storage.Read(ctx, namespace, name)
	if err != nil {
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
	kp, ok := obj.(*secretv0alpha1.Keeper)
	if !ok {
		return nil, fmt.Errorf("expected Keeper for create")
	}

	// Make sure only one type of keeper is configured
	err := checkKeeperType(kp)
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
	current, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, fmt.Errorf("get securevalue: %w", err)
	}

	// Makes sure the UID and ResourceVersion are OK.
	// TODO: this also makes it so the labels and annotations are additive, unless we check and remove manually.
	tmp, err := objInfo.UpdatedObject(ctx, current)
	if err != nil {
		return nil, false, fmt.Errorf("k8s updated object: %w", err)
	}

	newKeeper, ok := tmp.(*secretv0alpha1.Keeper)
	if !ok {
		return nil, false, fmt.Errorf("expected Keeper for update")
	}

	// TODO: do we need to do this here again? Probably not, but double-check!
	newKeeper.Annotations = cleanAnnotations(newKeeper.Annotations)

	// Make sure only one type of keeper is configured
	err = checkKeeperType(newKeeper)
	if err != nil {
		return nil, false, err
	}

	// Current implementation replaces everything passed in the spec, so it is not a PATCH. Do we want/need to support that?
	updatedKeeper, err := s.storage.Update(ctx, newKeeper)
	if err != nil {
		return nil, false, fmt.Errorf("failed to update keeper: %w", err)
	}

	return updatedKeeper, false, nil
}

// Delete calls the inner `store` (persistence) in order to delete the `Keeper`.
// The second return parameter `bool` indicates whether the delete was intant or not. It always is for `Keepers`.
func (s *KeeperRest) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)

	if err := s.storage.Delete(ctx, namespace, name); err != nil {
		return nil, false, fmt.Errorf("failed to delete keeper: %w", err)
	}

	return nil, true, nil
}

func checkKeeperType(s *secretv0alpha1.Keeper) error {
	sql := s.Spec.SQL
	aws := s.Spec.AWS
	azure := s.Spec.Azure
	gcp := s.Spec.GCP
	hashicorp := s.Spec.HashiCorp

	nonNilCount := 0
	for _, keeperType := range []interface{}{sql, aws, azure, gcp, hashicorp} {
		if keeperType != nil && !reflect.ValueOf(keeperType).IsNil() {
			nonNilCount++
		}
	}
	if nonNilCount == 0 {
		return fmt.Errorf("expecting one of the keeper types to be configured")
	} else if nonNilCount > 1 {
		return fmt.Errorf("only one type of keeper may be configured")
	}

	return nil
}
