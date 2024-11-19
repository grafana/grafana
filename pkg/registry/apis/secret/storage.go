package secret

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ rest.Scoper               = (*secureValueRESTStorage)(nil)
	_ rest.SingularNameProvider = (*secureValueRESTStorage)(nil)
	_ rest.Getter               = (*secureValueRESTStorage)(nil)
	_ rest.Lister               = (*secureValueRESTStorage)(nil)
	_ rest.Storage              = (*secureValueRESTStorage)(nil)
	_ rest.Creater              = (*secureValueRESTStorage)(nil)
	_ rest.Updater              = (*secureValueRESTStorage)(nil)
	_ rest.GracefulDeleter      = (*secureValueRESTStorage)(nil)
	_ rest.CollectionDeleter    = (*secureValueRESTStorage)(nil)
)

// secureValueRESTStorage is an implementation of CRUDL operations on a `securevalue` backed by a persistence layer `store`.
type secureValueRESTStorage struct {
	// TODO: do we want another interface that is less broad here? meaning that it doesn't have the `Decrypt` method at all.
	store          secretstore.SecureValueStore
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// New returns an empty `*SecureValue` that is used by the `Create` method.
func (s *secureValueRESTStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

// Destroy is called when? [TODO]
func (s *secureValueRESTStorage) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (s *secureValueRESTStorage) NamespaceScoped() bool {
	return true
}

// GetSingularName is used by `kubectl` discovery to have singular name representation of resources.
func (s *secureValueRESTStorage) GetSingularName() string {
	return s.resource.GetSingularName()
}

// NewList returns an empty `*SecureValueList` that is used by the `List` method.
func (s *secureValueRESTStorage) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

// ConvertToTable is used by Kubernetes and converts objects to `metav1.Table`.
func (s *secureValueRESTStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// List calls the inner `store` (persistence) and returns a list of `securevalues` within a `namespace` filtered by the `options`.
func (s *secureValueRESTStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns := request.NamespaceValue(ctx)

	return s.store.List(ctx, ns, options)
}

// Get calls the inner `store` (persistence) and returns a `securevalue` by `name`. It will NOT return the decrypted `value`.
func (s *secureValueRESTStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns := request.NamespaceValue(ctx)

	v, err := s.store.Read(ctx, ns, name)
	if v == nil { // TODO: this should come from the store as an `err != nil`.
		return nil, s.resource.NewNotFound(name)
	}

	return v, err
}

func checkPathOrValue(s *secret.SecureValue, mustExist bool) error {
	p := s.Spec.Path
	v := s.Spec.Value

	if p == "" && v == "" {
		if mustExist {
			return fmt.Errorf("expecting path or value to exist")
		}
		return nil
	}

	if p != "" && v != "" {
		return fmt.Errorf("only path *or* value may be configured at the same time")
	}
	return nil
}

// Create a new `securevalue`. Does some validation and allows empty `name` (generated).
func (s *secureValueRESTStorage) Create(
	ctx context.Context,
	obj runtime.Object,

	// TODO: How to define this function? perhaps would be useful to keep all validation here and not use `checkPathOrValue` for example..
	createValidation rest.ValidateObjectFunc,

	// TODO: How can we use these options? Looks useful. `dryRun` for dev as well.
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secret.SecureValue)
	if !ok {
		return nil, fmt.Errorf("expected SecureValue for create")
	}

	// TODO: path for key managers, value for everything else. actual schema for key managers might change so we need to update this as well.
	err := checkPathOrValue(sv, true)
	if err != nil {
		return nil, err
	}

	// A `securevalue` may be created without a `name`, which means it gets generated on-the-fly.
	if sv.Name == "" {
		// TODO: how can we make sure there are no conflicts with existing resources?
		generatedName, err := util.GetRandomString(8)
		if err != nil {
			return nil, err
		}

		// If the prefix is empty, we use `s`. Should we use `sv`?
		optionalPrefix := sv.GenerateName
		if optionalPrefix == "" {
			optionalPrefix = "s"
		}

		// A suffix is also automatically added by Kubernetes, and is separated by `-`. Our prefix is not. Should it?
		sv.Name = optionalPrefix + generatedName
	}

	return s.store.Create(ctx, sv)
}

// Update a `securevalue`'s `value`. The second return parameter indicates whether the resource was newly created.
func (s *secureValueRESTStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,

	// This lets a `securevalue` be created when an `Update` is called.
	// TODO: Can we control this toggle or is this set by the client? We could always ignore it.
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	// TODO: better error handling, don't ignore non-404.
	old, _ := s.Get(ctx, name, nil)
	if old == nil {
		old = &secret.SecureValue{}
	}

	// makes sure the UID and ResourceVersion are OK
	tmp, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}

	obj, ok := tmp.(*secret.SecureValue)
	if !ok {
		return nil, false, fmt.Errorf("expected SecureValue for update")
	}

	err = checkPathOrValue(obj, false)
	if err != nil {
		return nil, false, err
	}

	// Don't compare automatically set fields
	// TODO: perhaps this should be cleaned in the store always?
	obj.Annotations = secretstore.CleanAnnotations(obj.Annotations)

	// Is this really a create request.
	// TODO: do we want to support "create on update"?
	if obj.UID == "" {
		n, err := s.Create(ctx, obj, nil, &metav1.CreateOptions{})
		return n, true, err
	}

	// If the update does not change the `value` stored,
	// we can just compare the other properties to avoid unnecessarily going to the `store` if there's no update needed.
	if obj.Spec.Value == "" {
		// TODO: handle errors
		oldjson, _ := json.Marshal(old)
		newjson, _ := json.Marshal(obj)

		if bytes.Equal(oldjson, newjson) && len(newjson) > 0 {
			return old, false, nil
		}
	}

	obj, err = s.store.Update(ctx, obj)
	return obj, false, err
}

// Delete calls the inner `store` (persistence) in order to delete the `securevalue`.
// The second return parameter `bool` indicates whether the delete was intant or not. It always is for `securevalues`.
func (s *secureValueRESTStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	ns := request.NamespaceValue(ctx)

	// TODO: Make sure the second parameter is always `true` when `err == nil`.
	// Even when there is nothing to delete, because this is a `securevalue` and
	// we don't want to first do a `Get` to check whether the secret exists or not.
	return s.store.Delete(ctx, ns, name)
}

// DeleteCollection is not implemented. TODO: Do we want to implement it? Or do we want to restrict it on purpose and `securevalues` must be deleted one by one?
func (s *secureValueRESTStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for secrets not implemented")
}
