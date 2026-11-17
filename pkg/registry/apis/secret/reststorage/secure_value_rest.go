package reststorage

import (
	"context"
	"errors"
	"fmt"
	"slices"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	secureValueService contracts.SecureValueService
	resource           utils.ResourceInfo
	tableConverter     rest.TableConvertor
	tracer             trace.Tracer
}

// NewSecureValueRest is a returns a constructed `*SecureValueRest`.
func NewSecureValueRest(tracer trace.Tracer, secureValueService contracts.SecureValueService, resource utils.ResourceInfo) *SecureValueRest {
	return &SecureValueRest{
		secureValueService: secureValueService,
		resource:           resource,
		tableConverter:     resource.TableConverter(),
		tracer:             tracer,
	}
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
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, apierrors.NewUnauthorized("missing namespace in request context")
	}

	ctx, span := s.tracer.Start(ctx, "SecureValueRest.List", trace.WithAttributes(attribute.String("namespace", namespace)))
	defer span.End()

	secureValueList, err := s.secureValueService.List(ctx, xkube.Namespace(namespace))
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNamespaceEmpty) {
			return nil, apierrors.NewBadRequest(err.Error())
		}

		return nil, apierrors.NewInternalError(fmt.Errorf("failed to list secure values: %w", err))
	}

	labelSelector := options.LabelSelector

	if labelSelector == nil {
		labelSelector = labels.Everything()
	}

	// Extract all decrypter field selectors if present
	filterDecrypter := make([]string, 0)
	if options.FieldSelector != nil {
		requirements := options.FieldSelector.Requirements()
		for _, req := range requirements {
			if req.Field == "spec.decrypter" && req.Operator == "=" {
				filterDecrypter = append(filterDecrypter, req.Value)
			}
		}
		// Add tracing for all decrypters
		if len(filterDecrypter) > 0 {
			span.SetAttributes(attribute.StringSlice("fieldSelector.decrypters", filterDecrypter))
		}
	}

	allowedSecureValues := make([]secretv1beta1.SecureValue, 0, len(secureValueList.Items))

outer:
	for _, secureValue := range secureValueList.Items {
		// Filter by label selector
		if !labelSelector.Matches(labels.Set(secureValue.Labels)) {
			continue
		}

		// Filter by decrypter field selector (if any)
		for _, fd := range filterDecrypter {
			// Check if the filterDecrypter value exists in the decrypters array
			if !slices.Contains(secureValue.Spec.Decrypters, fd) {
				continue outer
			}
		}

		allowedSecureValues = append(allowedSecureValues, secureValue)
	}

	return &secretv1beta1.SecureValueList{Items: allowedSecureValues}, nil
}

// Get calls the inner `store` (persistence) and returns a `securevalue` by `name`. It will NOT return the decrypted `value`.
func (s *SecureValueRest) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, apierrors.NewUnauthorized("missing namespace in request context")
	}

	ctx, span := s.tracer.Start(ctx, "SecureValueRest.Get", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace),
	))
	defer span.End()

	sv, err := s.secureValueService.Read(ctx, xkube.Namespace(namespace), name)
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNotFound) {
			return nil, s.resource.NewNotFound(name)
		}
		if errors.Is(err, contracts.ErrSecureValueNamespaceEmpty) {
			return nil, apierrors.NewBadRequest(err.Error())
		}
		if errors.Is(err, contracts.ErrSecureValueNameEmpty) {
			return nil, apierrors.NewBadRequest(err.Error())
		}

		return nil, apierrors.NewInternalError(fmt.Errorf("failed to read secure value: %w", err))
	}

	return sv, nil
}

// Create a new `securevalue`. Does some validation and allows empty `name` (generated).
func (s *SecureValueRest) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	_ *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secretv1beta1.SecureValue)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected secure value for create"))
	}

	ctx, span := s.tracer.Start(ctx, "SecureValueRest.Create", trace.WithAttributes(
		attribute.String("name", sv.GetName()),
		attribute.String("namespace", sv.GetNamespace()),
	))
	defer span.End()

	if err := createValidation(ctx, obj); err != nil {
		return nil, err
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, apierrors.NewUnauthorized("missing auth info in request context")
	}

	read, err := s.secureValueService.Read(ctx, xkube.Namespace(sv.GetNamespace()), sv.GetName())
	if err != nil && !errors.Is(err, contracts.ErrSecureValueNotFound) {
		return nil, apierrors.NewInternalError(err)
	}
	if read != nil {
		return nil, apierrors.NewAlreadyExists(s.resource.GroupResource(), sv.GetName())
	}

	createdSecureValueMetadata, err := s.secureValueService.Create(ctx, sv, user.GetUID())
	if err != nil {
		return nil, apierrors.NewInternalError(fmt.Errorf("creating secure value %+w", err))
	}

	return createdSecureValueMetadata, nil
}

// Update a `securevalue`'s `value`. The second return parameter indicates whether the resource was newly created.
// Currently does not support "create on update" functionality. If the securevalue does not yet exist, it returns an error.
func (s *SecureValueRest) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	_ rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	_forceAllowCreate bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueRest.Update", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", request.NamespaceValue(ctx)),
	))
	defer span.End()

	oldObj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	// Makes sure the UID and ResourceVersion are OK.
	// TODO: this also makes it so the labels and annotations are additive, unless we check and remove manually.
	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("k8s updated object: %w", err))
	}

	if err := updateValidation(ctx, newObj, oldObj); err != nil {
		return nil, false, err
	}

	newSecureValue, ok := newObj.(*secretv1beta1.SecureValue)
	if !ok {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("expected secure value for update"))
	}

	newSecureValue.Annotations = xkube.CleanAnnotations(newSecureValue.Annotations)

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, false, apierrors.NewUnauthorized("missing auth info in request context")
	}

	updatedSecureValueMetadata, _, err := s.secureValueService.Update(ctx, newSecureValue, user.GetUID())
	if err != nil {
		return updatedSecureValueMetadata, false, apierrors.NewInternalError(fmt.Errorf("updating secure value metadata: %w", err))
	}

	return updatedSecureValueMetadata, false, nil
}

// The second return parameter `bool` indicates whether the delete was instant or not. It is always `false` for `securevalues`.
func (s *SecureValueRest) Delete(ctx context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, false, apierrors.NewUnauthorized("missing namespace in request context")
	}

	ctx, span := s.tracer.Start(ctx, "SecureValueRest.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace),
	))
	defer span.End()

	updatedSv, err := s.secureValueService.Delete(ctx, xkube.Namespace(namespace), name)
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNotFound) {
			return nil, false, s.resource.NewNotFound(name)
		}
		if errors.Is(err, contracts.ErrSecureValueNamespaceEmpty) {
			return nil, false, apierrors.NewBadRequest(err.Error())
		}
		if errors.Is(err, contracts.ErrSecureValueNameEmpty) {
			return nil, false, apierrors.NewBadRequest(err.Error())
		}
		return nil, false, apierrors.NewInternalError(fmt.Errorf("deleting secure value: %+w", err))
	}

	return updatedSv, false, nil
}
