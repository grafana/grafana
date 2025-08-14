package secret

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/client-go/dynamic"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	authsvc "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
)

var (
	ErrSecureValueNotFound      = contracts.ErrSecureValueNotFound
	ErrSecureValueAlreadyExists = contracts.ErrSecureValueAlreadyExists
)

// SecureValueClient is a CRUD client for the secure value API.
type SecureValueClient = contracts.SecureValueClient

type secureValueClient struct {
	namespace string
	service   contracts.SecureValueService
	validator contracts.SecureValueValidator
	access    authorizer.Authorizer
}

var _ SecureValueClient = &secureValueClient{}

func ProvideSecureValueClient(service contracts.SecureValueService, validator contracts.SecureValueValidator, access claims.AccessClient) SecureValueClient {
	return &secureValueClient{
		service:   service,
		validator: validator,
		access:    authsvc.NewResourceAuthorizer(access),
	}
}

// Client returns a resource interface that is scoped to a specific namespace.
func (c *secureValueClient) Client(ctx context.Context, namespace string) (dynamic.ResourceInterface, error) {
	return c.Namespace(namespace), nil
}

// Namespace returns a resource interface that is scoped to a specific namespace.
func (c *secureValueClient) Namespace(ns string) dynamic.ResourceInterface {
	info, err := claims.ParseNamespace(ns)
	if err != nil {
		panic(err)
	}
	if len(info.Value) == 0 {
		panic("namespace is required")
	}

	ret := *c
	ret.namespace = ns
	return &ret
}

// Create a new secure value. Options and subresources are not supported and ignored.
func (c *secureValueClient) Create(ctx context.Context, obj *unstructured.Unstructured, _ metav1.CreateOptions, _ ...string) (*unstructured.Unstructured, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}

	if err := c.checkAccess(ctx, obj.GetName(), utils.VerbCreate); err != nil {
		return nil, err
	}

	sv, err := fromUnstructured(obj)
	if err != nil {
		return nil, err
	}

	if sv.Namespace != c.namespace {
		return nil, fmt.Errorf("namespace mismatch")
	}
	if errs := c.validator.Validate(sv, nil, admission.Create); len(errs) > 0 {
		return nil, fmt.Errorf("invalid secure value: %w", errs.ToAggregate())
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	createdSv, err := c.service.Create(ctx, sv, user.GetUID())
	if err != nil {
		return nil, c.mapError(err, sv.Name)
	}

	return toUnstructured(createdSv)
}

// Get a secure value by name. Options and subresources are not supported and ignored.
func (c *secureValueClient) Get(ctx context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}
	if len(name) == 0 {
		return nil, fmt.Errorf("name is required")
	}

	if err := c.checkAccess(ctx, name, utils.VerbGet); err != nil {
		return nil, err
	}

	sv, err := c.service.Read(ctx, xkube.Namespace(c.namespace), name)
	if err != nil {
		return nil, c.mapError(err, name)
	}

	return toUnstructured(sv)
}

// Update a secure value. Options and subresources are not supported and ignored.
func (c *secureValueClient) Update(ctx context.Context, obj *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}

	if err := c.checkAccess(ctx, obj.GetName(), utils.VerbUpdate); err != nil {
		return nil, err
	}

	oldUnstructured, err := c.Get(ctx, obj.GetName(), metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	oldSv, err := fromUnstructured(oldUnstructured)
	if err != nil {
		return nil, err
	}

	sv, err := fromUnstructured(obj)
	if err != nil {
		return nil, err
	}

	if sv.Namespace != c.namespace {
		return nil, fmt.Errorf("namespace mismatch")
	}
	if errs := c.validator.Validate(sv, oldSv, admission.Update); len(errs) > 0 {
		return nil, fmt.Errorf("invalid secure value: %w", errs.ToAggregate())
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	updatedSv, _, err := c.service.Update(ctx, sv, user.GetUID())
	if err != nil {
		return nil, c.mapError(err, sv.Name)
	}

	return toUnstructured(updatedSv)
}

// Delete a secure value by name. Options and subresources are not supported and ignored.
func (c *secureValueClient) Delete(ctx context.Context, name string, _ metav1.DeleteOptions, _ ...string) error {
	if len(c.namespace) == 0 {
		return fmt.Errorf("namespace is required")
	}
	if len(name) == 0 {
		return fmt.Errorf("name is required")
	}

	if err := c.checkAccess(ctx, name, utils.VerbDelete); err != nil {
		return err
	}

	_, err := c.service.Delete(ctx, xkube.Namespace(c.namespace), name)
	return c.mapError(err, name)
}

// List all secure values in the namespace. Options and subresources are not supported and ignored.
func (c *secureValueClient) List(ctx context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if len(c.namespace) == 0 {
		return nil, fmt.Errorf("namespace is required")
	}

	if err := c.checkAccess(ctx, "", utils.VerbList); err != nil {
		return nil, err
	}

	list, err := c.service.List(ctx, xkube.Namespace(c.namespace))
	if err != nil {
		return nil, c.mapError(err, "")
	}

	items := make([]unstructured.Unstructured, 0, len(list.Items))
	for _, sv := range list.Items {
		u, err := toUnstructured(&sv)
		if err != nil {
			return nil, err
		}

		items = append(items, *u)
	}

	return &unstructured.UnstructuredList{
		Items: items,
	}, nil
}

// DeleteCollection is not supported and returns an error.
func (c *secureValueClient) DeleteCollection(_ context.Context, _ metav1.DeleteOptions, _ metav1.ListOptions) error {
	return fmt.Errorf("deleteCollection is not supported")
}

// Watch is not supported and returns an error.
func (c *secureValueClient) Watch(_ context.Context, _ metav1.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("watch is not supported")
}

// Patch is not supported and returns an error.
func (c *secureValueClient) Patch(_ context.Context, _ string, _ types.PatchType, _ []byte, _ metav1.PatchOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("patch is not supported")
}

// Apply is not supported and returns an error.
func (c *secureValueClient) Apply(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("apply is not supported")
}

// UpdateStatus is not supported and returns an error.
func (c *secureValueClient) UpdateStatus(_ context.Context, _ *unstructured.Unstructured, _ metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("updateStatus is not supported")
}

// ApplyStatus is not supported and returns an error.
func (c *secureValueClient) ApplyStatus(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("applyStatus is not supported")
}

// Maps an error from the domain to a K8s API Status error.
func (c *secureValueClient) mapError(err error, name string) error {
	if err == nil {
		return nil
	}

	gr := secretv1beta1.SecureValuesResourceInfo.GroupResource()

	switch {
	case errors.Is(err, ErrSecureValueNotFound):
		return apierrors.NewNotFound(gr, name)
	case errors.Is(err, ErrSecureValueAlreadyExists):
		return apierrors.NewAlreadyExists(gr, name)
	}

	return apierrors.NewInternalError(err)
}

func (c *secureValueClient) checkAccess(ctx context.Context, name, verb string) error {
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return apierrors.NewUnauthorized("missing auth info in context")
	}

	gr := secretv1beta1.SecureValuesResourceInfo.GroupResource()

	if !claims.NamespaceMatches(authInfo.GetNamespace(), c.namespace) {
		return apierrors.NewForbidden(gr, name, fmt.Errorf("namespace mismatch: %s != %s", authInfo.GetNamespace(), c.namespace))
	}

	decision, reason, err := c.access.Authorize(ctx, authorizer.AttributesRecord{
		Verb:            verb,
		Namespace:       c.namespace,
		APIGroup:        secretv1beta1.APIGroup,
		APIVersion:      secretv1beta1.APIVersion,
		Resource:        gr.Resource,
		Subresource:     "",
		Name:            name,
		ResourceRequest: true,
	})

	if err != nil {
		return apierrors.NewForbidden(gr, name, fmt.Errorf("failed to check access: %w", err))
	}

	if decision != authorizer.DecisionAllow {
		return apierrors.NewForbidden(gr, name, fmt.Errorf("no access to %s: %s", verb, reason))
	}

	return nil
}

func toUnstructured(sv *secretv1beta1.SecureValue) (*unstructured.Unstructured, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(sv)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: unstructuredObj}, nil
}

func fromUnstructured(u *unstructured.Unstructured) (*secretv1beta1.SecureValue, error) {
	sv := new(secretv1beta1.SecureValue)
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, sv); err != nil {
		return nil, err
	}
	return sv, nil
}
