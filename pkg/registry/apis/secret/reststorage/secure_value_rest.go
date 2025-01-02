package reststorage

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

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
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
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
	storage        contracts.SecureValueStorage
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// NewSecureValueRest is a returns a constructed `*SecureValueRest`.
func NewSecureValueRest(storage contracts.SecureValueStorage, resource utils.ResourceInfo) *SecureValueRest {
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
	namespace := xkube.Namespace(request.NamespaceValue(ctx))

	secureValueList, err := s.storage.List(ctx, namespace, options)
	if err != nil {
		return nil, fmt.Errorf("failed to list secure values: %w", err)
	}

	return secureValueList, nil
}

// Get calls the inner `store` (persistence) and returns a `securevalue` by `name`. It will NOT return the decrypted `value`.
func (s *SecureValueRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	nn := xkube.NameNamespace{
		Name:      name,
		Namespace: xkube.Namespace(request.NamespaceValue(ctx)),
	}

	sv, err := s.storage.Read(ctx, nn)
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNotFound) {
			return nil, s.resource.NewNotFound(name)
		}

		return nil, fmt.Errorf("failed to read secure value: %w", err)
	}

	return sv, nil
}

// Create a new `securevalue`. Does some validation and allows empty `name` (generated).
func (s *SecureValueRest) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secretv0alpha1.SecureValue)
	if !ok {
		return nil, fmt.Errorf("expected SecureValue for create")
	}

	if err := createValidation(ctx, obj); err != nil {
		return nil, fmt.Errorf("create validation failed: %w", err)
	}

	createdSecureValue, err := s.storage.Create(ctx, sv)
	if err != nil {
		return nil, fmt.Errorf("failed to create secure value: %w", err)
	}

	return createdSecureValue, nil
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
	oldObj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, fmt.Errorf("get securevalue: %w", err)
	}

	// Makes sure the UID and ResourceVersion are OK.
	// TODO: this also makes it so the labels and annotations are additive, unless we check and remove manually.
	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, fmt.Errorf("k8s updated object: %w", err)
	}

	if err := updateValidation(ctx, newObj, oldObj); err != nil {
		return nil, false, fmt.Errorf("update validation failed: %w", err)
	}

	newSecureValue, ok := newObj.(*secretv0alpha1.SecureValue)
	if !ok {
		return nil, false, fmt.Errorf("expected SecureValue for update")
	}

	// TODO: do we need to do this here again? Probably not, but double-check!
	newSecureValue.Annotations = xkube.CleanAnnotations(newSecureValue.Annotations)

	// Current implementation replaces everything passed in the spec, so it is not a PATCH. Do we want/need to support that?
	updatedSecureValue, err := s.storage.Update(ctx, newSecureValue)
	if err != nil {
		return nil, false, fmt.Errorf("failed to update secure value: %w", err)
	}

	return updatedSecureValue, false, nil
}

// Delete calls the inner `store` (persistence) in order to delete the `securevalue`.
// The second return parameter `bool` indicates whether the delete was instant or not. It always is for `securevalues`.
func (s *SecureValueRest) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	nn := xkube.NameNamespace{
		Name:      name,
		Namespace: xkube.Namespace(request.NamespaceValue(ctx)),
	}

	if err := s.storage.Delete(ctx, nn); err != nil {
		return nil, false, fmt.Errorf("delete secure value: %w", err)
	}

	return nil, true, nil
}

// ValidateSecureValue does basic spec validation of a securevalue.
func ValidateSecureValue(sv *secretv0alpha1.SecureValue, operation admission.Operation) field.ErrorList {
	errs := make(field.ErrorList, 0)

	// Operation-specific field validation.
	switch operation {
	case admission.Create:
		if sv.Spec.Title == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "title"), "a `title` is required"))
		}

		if sv.Spec.Keeper == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "keeper"), "a `keeper` is required"))
		}

		if sv.Spec.Value == "" && sv.Spec.Ref == "" {
			errs = append(errs, field.Required(field.NewPath("spec"), "either a `value` or `ref` is required"))
		}

		if sv.Spec.Value != "" && sv.Spec.Ref != "" {
			errs = append(errs, field.Required(field.NewPath("spec"), "only one of `value` or `ref` can be set"))
		}

		if len(sv.Spec.Audiences) == 0 {
			errs = append(errs, field.Required(field.NewPath("spec", "audiences"), "an `audiences` is required"))
		}

	// If we plan to support PATCH-style updates, we shouldn't be requiring fields to be set.
	case admission.Update:
		if sv.Spec.Value != "" && sv.Spec.Ref != "" {
			errs = append(errs, field.Required(field.NewPath("spec"), "either leave both `value` and `ref` empty, or set one of them, but not both"))
		}

	case admission.Delete:
	case admission.Connect:
	}

	// General validations.

	audienceGroups := make(map[string]map[string]int, 0)

	// Audience must match "{group}/{name OR *}" and must be unique.
	for i, audience := range sv.Spec.Audiences {
		group, name, found := strings.Cut(audience, "/")
		if !found {
			errs = append(
				errs,
				field.Invalid(field.NewPath("spec", "audiences", "["+strconv.Itoa(i)+"]"), audience, "an audience must have the format `{string}/{string}`"),
			)

			continue
		}

		if group == "" {
			errs = append(
				errs,
				field.Invalid(field.NewPath("spec", "audiences", "["+strconv.Itoa(i)+"]"), audience, "an audience group must be present"),
			)

			continue
		}

		if found && name == "" {
			errs = append(
				errs,
				field.Invalid(field.NewPath("spec", "audiences", "["+strconv.Itoa(i)+"]"), audience, "an audience name must be present (use * for match-all)"),
			)

			continue
		}

		if _, exists := audienceGroups[group][name]; exists {
			errs = append(
				errs,
				field.Invalid(
					field.NewPath("spec", "audiences", "["+strconv.Itoa(i)+"]"),
					audience,
					"the same audience already exists and must be unique",
				),
			)

			continue
		}

		if audienceGroups[group] == nil {
			audienceGroups[group] = make(map[string]int)
		}

		audienceGroups[group][name] = i
	}

	// In case of a "{group}/*" any other "{group}/{name}" with a matching "{group}" is redundant.
	for group, names := range audienceGroups {
		const wildcard = "*"

		if _, exists := names[wildcard]; exists && len(names) > 1 {
			for name, i := range names {
				if name == wildcard {
					continue
				}

				errs = append(
					errs,
					field.Invalid(
						field.NewPath("spec", "audiences", "["+strconv.Itoa(i)+"]"),
						group+"/"+name,
						`the audience is not required as there is a wildcard "`+group+`/*" which takes precedence`,
					),
				)
			}
		}
	}

	return errs
}
