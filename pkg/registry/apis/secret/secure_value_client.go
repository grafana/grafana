package secret

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana-app-sdk/resource"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	authsvc "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// SecureValueClientProvider provides a typed and namespaced SecureValueClient interface implementation.
type SecureValueClientProvider = contracts.SecureValueClientProvider

// SecureValueClient is a CRUD client for the secure value API which implements resource.Client.
type SecureValueClient = contracts.SecureValueClient

type newSecureValueClient struct {
	schema    resource.Schema
	service   contracts.SecureValueService
	validator contracts.SecureValueValidator
	access    authorizer.Authorizer
}

func ProvideSecureValueClientProvider(service contracts.SecureValueService, validator contracts.SecureValueValidator, access claims.AccessClient) SecureValueClientProvider {
	return &newSecureValueClient{
		schema:    secretv1beta1.SecureValueSchema(),
		service:   service,
		validator: validator,
		access:    authsvc.NewResourceAuthorizer(access),
	}
}

func (c *newSecureValueClient) Client(ctx context.Context, namespace string) (SecureValueClient, error) {
	return resource.NewNamespaced(
		resource.NewTypedClient[*secretv1beta1.SecureValue, *secretv1beta1.SecureValueList](c, secretv1beta1.SecureValueKind()),
		namespace,
	), nil
}

func (c *newSecureValueClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error) {
	into := c.schema.ZeroValue()
	if err := c.CreateInto(ctx, identifier, obj, options, into); err != nil {
		return nil, err
	}
	return into, nil
}

func (c *newSecureValueClient) CreateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, _ resource.CreateOptions, into resource.Object) error {
	if obj == nil {
		return fmt.Errorf("obj cannot be nil")
	}
	if into == nil {
		return fmt.Errorf("into cannot be nil")
	}

	sv, ok := obj.(*secretv1beta1.SecureValue)
	if !ok {
		return fmt.Errorf("expected obj to be *secretv1beta1.SecureValue, got %T", obj)
	}

	if errs := c.validator.Validate(sv, nil, admission.Create); len(errs) > 0 {
		return fmt.Errorf("invalid secure value: %w", errs.ToAggregate())
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	if err := c.checkAccess(ctx, identifier.Namespace, identifier.Name, utils.VerbCreate); err != nil {
		return err
	}

	createdSv, err := c.service.Create(ctx, sv, user.GetUID())
	if err != nil {
		return err
	}

	ret, ok := into.(*secretv1beta1.SecureValue)
	if !ok {
		return fmt.Errorf("expected into to be *secretv1beta1.SecureValue, got %T", into)
	}

	createdSv.DeepCopyInto(ret)

	return nil
}

func (c *newSecureValueClient) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	into := c.schema.ZeroValue()
	err := c.GetInto(ctx, identifier, into)
	if err != nil {
		return nil, err
	}
	return into, nil
}

func (c *newSecureValueClient) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	if into == nil {
		return fmt.Errorf("into cannot be nil")
	}
	if len(identifier.Namespace) == 0 {
		return fmt.Errorf("namespace is required")
	}
	if len(identifier.Name) == 0 {
		return fmt.Errorf("name is required")
	}

	if err := c.checkAccess(ctx, identifier.Namespace, identifier.Name, utils.VerbGet); err != nil {
		return err
	}

	sv, err := c.service.Read(ctx, xkube.Namespace(identifier.Namespace), identifier.Name)
	if err != nil {
		return err
	}

	ret, ok := into.(*secretv1beta1.SecureValue)
	if !ok {
		return fmt.Errorf("expected into to be *secretv1beta1.SecureValue, got %T", into)
	}

	sv.DeepCopyInto(ret)

	return nil
}

func (c *newSecureValueClient) Update(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.UpdateOptions) (resource.Object, error) {
	if obj == nil {
		return nil, fmt.Errorf("obj cannot be nil")
	}
	into := c.schema.ZeroValue()
	err := c.UpdateInto(ctx, identifier, obj, options, into)
	if err != nil {
		return nil, err
	}
	return into, nil
}

func (c *newSecureValueClient) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, _ resource.UpdateOptions, into resource.Object) error {
	if obj == nil {
		return fmt.Errorf("obj cannot be nil")
	}
	if into == nil {
		return fmt.Errorf("into cannot be nil")
	}

	oldObj, err := c.Get(ctx, identifier)
	if err != nil {
		return err
	}

	oldSv, ok := oldObj.(*secretv1beta1.SecureValue)
	if !ok {
		return fmt.Errorf("expected oldObj to be *secretv1beta1.SecureValue, got %T", oldObj)
	}

	sv, ok := obj.(*secretv1beta1.SecureValue)
	if !ok {
		return fmt.Errorf("expected obj to be *secretv1beta1.SecureValue, got %T", obj)
	}

	if errs := c.validator.Validate(sv, oldSv, admission.Update); len(errs) > 0 {
		return fmt.Errorf("invalid secure value: %w", errs.ToAggregate())
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	if err := c.checkAccess(ctx, identifier.Namespace, identifier.Name, utils.VerbUpdate); err != nil {
		return err
	}

	updatedSv, _, err := c.service.Update(ctx, sv, user.GetUID())
	if err != nil {
		return err
	}

	ret, ok := into.(*secretv1beta1.SecureValue)
	if !ok {
		return fmt.Errorf("expected into to be *secretv1beta1.SecureValue, got %T", into)
	}

	updatedSv.DeepCopyInto(ret)

	return nil
}

func (c *newSecureValueClient) Delete(ctx context.Context, identifier resource.Identifier, _ resource.DeleteOptions) error {
	if len(identifier.Namespace) == 0 {
		return fmt.Errorf("namespace is required")
	}
	if len(identifier.Name) == 0 {
		return fmt.Errorf("name is required")
	}

	if err := c.checkAccess(ctx, identifier.Namespace, identifier.Name, utils.VerbDelete); err != nil {
		return err
	}

	_, err := c.service.Delete(ctx, xkube.Namespace(identifier.Namespace), identifier.Name)
	return err
}

func (c *newSecureValueClient) List(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
	into := c.schema.ZeroListValue()
	if err := c.ListInto(ctx, namespace, options, into); err != nil {
		return nil, err
	}
	return into, nil
}

func (c *newSecureValueClient) ListInto(ctx context.Context, namespace string, options resource.ListOptions, into resource.ListObject) error {
	if into == nil {
		return fmt.Errorf("into cannot be nil")
	}
	if len(namespace) == 0 {
		return fmt.Errorf("namespace is required")
	}

	if err := c.checkAccess(ctx, namespace, "", utils.VerbList); err != nil {
		return err
	}

	secureValueList, err := c.service.List(ctx, xkube.Namespace(namespace))
	if err != nil {
		return err
	}

	ret, ok := into.(*secretv1beta1.SecureValueList)
	if !ok {
		return fmt.Errorf("expected into to be *secretv1beta1.SecureValueList, got %T", into)
	}

	secureValueList.DeepCopyInto(ret)

	return nil
}

func (c *newSecureValueClient) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions) (resource.Object, error) {
	return nil, fmt.Errorf("patch is not supported used Update instead")
}

func (c *newSecureValueClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
	return fmt.Errorf("patchInto is not supported used UpdateInto instead")
}

func (c *newSecureValueClient) Watch(ctx context.Context, namespace string, options resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, fmt.Errorf("watch is not supported")
}

func (c *newSecureValueClient) checkAccess(ctx context.Context, namespace, name, verb string) error {
	gr := secretv1beta1.SecureValuesResourceInfo.GroupResource()

	decision, reason, err := c.access.Authorize(ctx, authorizer.AttributesRecord{
		Verb:            verb,
		APIGroup:        gr.Group,
		Resource:        gr.Resource,
		Namespace:       namespace,
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
