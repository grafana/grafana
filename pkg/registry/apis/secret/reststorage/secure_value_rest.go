package reststorage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/util"
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
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// NewSecureValueRest is a returns a constructed `*SecureValueRest`.
func NewSecureValueRest(resource utils.ResourceInfo) *SecureValueRest {
	return &SecureValueRest{resource, resource.TableConverter()}
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
	// TODO: implement me
	return nil, nil
}

// Get calls the inner `store` (persistence) and returns a `securevalue` by `name`. It will NOT return the decrypted `value`.
func (s *SecureValueRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// TODO: implement me
	return nil, nil
}

func checkRefOrValue(s *secret.SecureValue, mustExist bool) error {
	p := s.Spec.Ref
	v := s.Spec.Value

	if p == "" && v == "" {
		if mustExist {
			return fmt.Errorf("expecting ref or value to exist")
		}
		return nil
	}

	if p != "" && v != "" {
		return fmt.Errorf("only ref *or* value may be configured at the same time")
	}
	return nil
}

// Create a new `securevalue`. Does some validation and allows empty `name` (generated).
func (s *SecureValueRest) Create(
	ctx context.Context,
	obj runtime.Object,

	// TODO: How to define this function? perhaps would be useful to keep all validation here and not use `checkRefOrValue` for example..
	createValidation rest.ValidateObjectFunc,

	// TODO: How can we use these options? Looks useful. `dryRun` for dev as well.
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secret.SecureValue)
	if !ok {
		return nil, fmt.Errorf("expected SecureValue for create")
	}

	err := checkRefOrValue(sv, true)
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

	// TODO: implement creation in storage
	return nil, nil
}

// Update a `securevalue`'s `value`. The second return parameter indicates whether the resource was newly created.
func (s *SecureValueRest) Update(
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

	err = checkRefOrValue(obj, false)
	if err != nil {
		return nil, false, err
	}

	// Don't compare automatically set fields
	// TODO: perhaps this should be cleaned in the store always?
	obj.Annotations = cleanAnnotations(obj.Annotations)

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

	// TODO: implement update in storage
	return nil, false, nil
}

// Delete calls the inner `store` (persistence) in order to delete the `securevalue`.
// The second return parameter `bool` indicates whether the delete was intant or not. It always is for `securevalues`.
func (s *SecureValueRest) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// TODO: Make sure the second parameter is always `true` when `err == nil`.
	// Even when there is nothing to delete, because this is a `securevalue` and
	// we don't want to first do a `Get` to check whether the secret exists or not.

	// TODO: implement delete in storage
	return nil, false, nil
}
