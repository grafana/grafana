package inline

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type LocalInlineSecureValueService struct {
	tracer             trace.Tracer
	secureValueService contracts.SecureValueService
	accessChecker      authlib.AccessChecker
}

var _ contracts.InlineSecureValueSupport = &LocalInlineSecureValueService{}

func NewLocalInlineSecureValueService(
	tracer trace.Tracer,
	secureValueService contracts.SecureValueService,
	accessClient authlib.AccessClient,
) contracts.InlineSecureValueSupport {
	return &LocalInlineSecureValueService{
		tracer:             tracer,
		secureValueService: secureValueService,
		accessChecker:      accessClient,
	}
}

func (s *LocalInlineSecureValueService) CanReference(ctx context.Context, owner common.ObjectReference, names ...string) error {
	ctx, span := s.tracer.Start(ctx, "InlineSecureValueService.CanReference", trace.WithAttributes(
		attribute.String("owner.namespace", owner.Namespace),
		attribute.String("owner.apiGroup", owner.APIGroup),
		attribute.String("owner.apiVersion", owner.APIVersion),
		attribute.String("owner.kind", owner.Kind),
		attribute.String("owner.name", owner.Name),
		attribute.StringSlice("secureValueNames", names),
	))
	defer span.End()

	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return contracts.ErrInlineSecureValueNoAuth
	}

	if owner.Namespace == "" || !authlib.NamespaceMatches(authInfo.GetNamespace(), owner.Namespace) {
		return fmt.Errorf("owner namespace %s does not match auth info namespace %s: %w", owner.Namespace, authInfo.GetNamespace(), contracts.ErrInlineSecureValueInvalidOwner)
	}

	if owner.APIGroup == "" || owner.APIVersion == "" || owner.Kind == "" || owner.Name == "" {
		return contracts.ErrInlineSecureValueInvalidOwner
	}

	if len(names) == 0 {
		return fmt.Errorf("no inline secure values provided: %w", contracts.ErrInlineSecureValueInvalidName)
	}

	for _, name := range names {
		if name == "" {
			return fmt.Errorf("empty secure value name: %w", contracts.ErrInlineSecureValueInvalidName)
		}

		owned, err := s.isSecureValueOwnedByResource(ctx, owner, name)
		if err != nil {
			return err
		}

		if !owned {
			if err := s.canIdentityReadSecureValue(ctx, xkube.Namespace(owner.Namespace), name); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *LocalInlineSecureValueService) isSecureValueOwnedByResource(ctx context.Context, owner common.ObjectReference, name string) (bool, error) {
	sv, err := s.secureValueService.Read(ctx, xkube.Namespace(owner.Namespace), name)
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNotFound) {
			return false, contracts.ErrInlineSecureValueNotFound
		}

		return false, fmt.Errorf("error reading secure value %s: %w", name, err)
	}

	secureValueOwners := sv.GetOwnerReferences()
	if len(secureValueOwners) > 1 {
		return false, fmt.Errorf("bug found: secure value %s with multiple owners, expected only one", name)
	}

	if len(secureValueOwners) == 1 {
		actualOwner := secureValueOwners[0]

		gv, err := schema.ParseGroupVersion(actualOwner.APIVersion)
		if err != nil {
			return false, fmt.Errorf("bug found: secure value %s should have valid group version here: %w", name, err)
		}
		if gv.Group == "" {
			return false, fmt.Errorf("bug found: secure value %s should have a non-empty group in the owner reference", name)
		}

		sameOwner := owner.APIGroup == gv.Group && owner.Kind == actualOwner.Kind && owner.Name == actualOwner.Name
		if sameOwner {
			return true, nil // The secure value is owned by the same owner reference, pass!
		}

		return false, fmt.Errorf("secure value %s is not owned by %s/%s/%s/%s: %w", name, owner.APIGroup, owner.APIVersion, owner.Kind, owner.Name, contracts.ErrInlineSecureValueMismatchOwner)
	}

	// not owned
	return false, nil
}

func (s *LocalInlineSecureValueService) canIdentityReadSecureValue(ctx context.Context, namespace xkube.Namespace, name string) error {
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return contracts.ErrInlineSecureValueNoAuth
	}

	// If the secure value is shared, we always need a user/svc account in the context.
	if authInfo.GetIdentityType() != authlib.TypeUser && authInfo.GetIdentityType() != authlib.TypeServiceAccount {
		return fmt.Errorf("identity type %s not allowed, expected either %s or %s: %w", authInfo.GetIdentityType(), authlib.TypeUser, authlib.TypeServiceAccount, contracts.ErrInlineSecureValueInvalidIdentity)
	}

	resp, err := s.accessChecker.Check(ctx, authInfo, authlib.CheckRequest{
		Verb:      utils.VerbGet,
		Group:     secretv1beta1.APIGroup,
		Resource:  secretv1beta1.SecureValuesResourceInfo.GroupResource().Resource,
		Namespace: namespace.String(),
		Name:      name,
	}, "")
	if err != nil {
		return fmt.Errorf("checking access for secure value %s: %w", name, err)
	}

	if !resp.Allowed {
		return fmt.Errorf("identity is not allowed to reference secure value %s: %w", name, contracts.ErrInlineSecureValueCannotReference)
	}

	return nil
}

func (s *LocalInlineSecureValueService) verifyOwnerAndAuth(ctx context.Context, owner common.ObjectReference) (authlib.AuthInfo, error) {
	// Any valid identity can create inline secure values
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return nil, contracts.ErrInlineSecureValueNoAuth
	}

	// Make sure the owner matches the identity when it is not global
	if owner.Namespace == "" || !authlib.NamespaceMatches(authInfo.GetNamespace(), owner.Namespace) {
		return nil, fmt.Errorf("owner namespace %s does not match auth info namespace %s: %w", owner.Namespace, authInfo.GetNamespace(), contracts.ErrInlineSecureValueInvalidOwner)
	}

	if owner.Namespace == "" || owner.APIGroup == "" || owner.APIVersion == "" || owner.Kind == "" || owner.Name == "" {
		return nil, fmt.Errorf("[verifyOwnerAndAuth:%+v]: %w", owner, contracts.ErrInlineSecureValueInvalidOwner)
	}

	return authInfo, nil
}

func (s *LocalInlineSecureValueService) CreateInline(ctx context.Context, owner common.ObjectReference, value common.RawSecureValue, desc *string) (string, error) {
	ctx, span := s.tracer.Start(ctx, "InlineSecureValueService.CreateInline", trace.WithAttributes(
		attribute.String("owner.namespace", owner.Namespace),
		attribute.String("owner.apiGroup", owner.APIGroup),
		attribute.String("owner.apiVersion", owner.APIVersion),
		attribute.String("owner.kind", owner.Kind),
		attribute.String("owner.name", owner.Name),
	))
	defer span.End()

	authInfo, err := s.verifyOwnerAndAuth(ctx, owner)
	if err != nil {
		return "", err
	}

	if value.IsZero() {
		return "", fmt.Errorf("trying to create an inline secure value with empty value: %w", contracts.ErrInlineSecureValueInvalidName)
	}

	// TODO(2025-07-31): when we migrate to using the common type, we don't need this conversion.
	secret := secretv1beta1.ExposedSecureValue(value)

	// The owner group can always decrypt
	decrypters := []string{owner.APIGroup}

	serviceIdentity, ok := authInfo.GetExtra()[authn.ServiceIdentityKey]
	if ok && len(serviceIdentity) > 0 && serviceIdentity[0] != owner.APIGroup {
		decrypters = append(decrypters, serviceIdentity[0])
	}

	description := fmt.Sprintf("Inline secure value for %s/%s in %s/%s", owner.Kind, owner.Name, owner.APIGroup, owner.APIVersion)
	if desc != nil {
		trim := strings.TrimSpace(*desc)
		if len(trim) > 0 {
			description = trim
		}
	}

	obj := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName:    "inline-",
			Namespace:       owner.Namespace,
			OwnerReferences: []metav1.OwnerReference{owner.ToOwnerReference()},
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: description,
			Value:       &secret,
			Decrypters:  decrypters,
		},
	}

	createdSv, err := s.secureValueService.Create(ctx, obj, authInfo.GetUID())
	if err != nil {
		return "", fmt.Errorf("error creating secure value for owner %v: %w", owner, err)
	}

	return createdSv.GetName(), nil
}

func (s *LocalInlineSecureValueService) DeleteWhenOwnedByResource(ctx context.Context, owner common.ObjectReference, names ...string) error {
	ctx, span := s.tracer.Start(ctx, "InlineSecureValueService.DeleteWhenOwnedByResource", trace.WithAttributes(
		attribute.String("owner.namespace", owner.Namespace),
		attribute.String("owner.apiGroup", owner.APIGroup),
		attribute.String("owner.apiVersion", owner.APIVersion),
		attribute.String("owner.kind", owner.Kind),
		attribute.String("owner.name", owner.Name),
		attribute.StringSlice("secureValueNames", names),
	))
	defer span.End()

	if _, err := s.verifyOwnerAndAuth(ctx, owner); err != nil {
		return err
	}

	// TEMPORARY: Enable migration of data sources, without needing breaking changes on the API contract.
	if len(names) == 1 && names[0] == "*" {
		if err := s.secureValueService.DeleteAllFromGroup(ctx, xkube.Namespace(owner.Namespace), owner.APIGroup); err != nil {
			return fmt.Errorf("deleting all from group %q in namespace %q: %w", owner.APIGroup, owner.Namespace, err)
		}

		return nil
	}

	for _, name := range names {
		owned, err := s.isSecureValueOwnedByResource(ctx, owner, name)
		if err != nil {
			return fmt.Errorf("error checking if secure value %s is owned by %v: %w", name, owner, err)
		}

		if owned {
			if _, err := s.secureValueService.Delete(ctx, xkube.Namespace(owner.Namespace), name); err != nil {
				if errors.Is(err, contracts.ErrSecureValueNotFound) {
					return contracts.ErrInlineSecureValueNotFound
				}

				return fmt.Errorf("error deleting secure value %s for owner %v: %w", name, owner, err)
			}
		}
	}

	return nil
}
