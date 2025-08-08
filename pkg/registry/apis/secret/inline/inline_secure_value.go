package inline

import (
	"context"
	"errors"
	"fmt"

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
	"github.com/grafana/grafana/pkg/util"
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
		return fmt.Errorf("missing auth info in context")
	}

	if owner.Namespace == "" || !authlib.NamespaceMatches(authInfo.GetNamespace(), owner.Namespace) {
		return fmt.Errorf("owner namespace %s does not match auth info namespace %s", owner.Namespace, authInfo.GetNamespace())
	}

	if owner.APIGroup == "" || owner.APIVersion == "" || owner.Kind == "" || owner.Name == "" {
		return fmt.Errorf("owner reference must have a valid API group, API version, kind and name")
	}

	if len(names) == 0 {
		return fmt.Errorf("no inline secure values provided")
	}

	for _, name := range names {
		if name == "" {
			return fmt.Errorf("empty secure value name")
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
			return false, err
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

		return false, fmt.Errorf(
			"secure value %s is not owned by %s/%s/%s/%s but by %s/%s/%s",
			name, owner.APIGroup, owner.APIVersion, owner.Kind, owner.Name, actualOwner.APIVersion, actualOwner.Kind, actualOwner.Name,
		)
	}

	// not owned
	return false, nil
}

func (s *LocalInlineSecureValueService) canIdentityReadSecureValue(ctx context.Context, namespace xkube.Namespace, name string) error {
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	// If the secure value is shared, we always need a user/svc account in the context.
	if authInfo.GetIdentityType() != authlib.TypeUser && authInfo.GetIdentityType() != authlib.TypeServiceAccount {
		return fmt.Errorf("identity type %s not allowed, expected either %s or %s", authInfo.GetIdentityType(), authlib.TypeUser, authlib.TypeServiceAccount)
	}

	resp, err := s.accessChecker.Check(ctx, authInfo, authlib.CheckRequest{
		Verb:      utils.VerbGet,
		Group:     secretv1beta1.APIGroup,
		Resource:  secretv1beta1.SecureValuesResourceInfo.GroupResource().Resource,
		Namespace: namespace.String(),
		Name:      name,
	})
	if err != nil {
		return fmt.Errorf("checking access for secure value %s: %w", name, err)
	}

	if !resp.Allowed {
		return fmt.Errorf("identity is not allowed to reference secure value %s", name)
	}

	return nil
}

func (s *LocalInlineSecureValueService) verifyOwnerAndAuth(ctx context.Context, owner common.ObjectReference) (authlib.AuthInfo, error) {
	// Any valid identity can create inline secure values
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	// Make sure the owner matches the identity when it is not global
	if owner.Namespace == "" || !authlib.NamespaceMatches(authInfo.GetNamespace(), owner.Namespace) {
		return nil, fmt.Errorf("owner namespace %s does not match auth info namespace %s", owner.Namespace, authInfo.GetNamespace())
	}

	if owner.Namespace == "" || owner.APIGroup == "" || owner.APIVersion == "" || owner.Kind == "" || owner.Name == "" {
		return nil, fmt.Errorf("owner reference must have a valid API group, API version, kind, namespace and name")
	}

	return authInfo, nil
}

func (s *LocalInlineSecureValueService) CreateInline(ctx context.Context, owner common.ObjectReference, value common.RawSecureValue) (string, error) {
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
		return "", fmt.Errorf("trying to create an inline secure value with empty value")
	}

	// TODO(2025-07-31): when we migrate to using the common type, we don't need this conversion.
	secret := secretv1beta1.ExposedSecureValue(value)

	// The owner group can always decrypt
	decrypters := []string{owner.APIGroup, "??? UNIFIED STORAGE IDENTITY ???"}

	serviceIdentity, ok := authInfo.GetExtra()[authn.ServiceIdentityKey]
	if ok && len(serviceIdentity) > 0 && serviceIdentity[0] != owner.APIGroup {
		decrypters = append(decrypters, serviceIdentity...)
	}

	obj := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			//GenerateName:    "inline-",
			Name:            "inline-" + util.GenerateShortUID(),
			Namespace:       owner.Namespace,
			OwnerReferences: []metav1.OwnerReference{owner.ToOwnerReference()},
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: fmt.Sprintf("Inline secure value for %s/%s in %s/%s", owner.Kind, owner.Name, owner.APIGroup, owner.APIVersion),
			Value:       &secret,
			Decrypters:  decrypters,
		},
	}

	createdSv, err := s.secureValueService.Create(ctx, obj, authInfo.GetUID())
	if err != nil {
		return "", fmt.Errorf("error creating secure value %s for owner %v: %w", obj.Name, owner, err)
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

	for _, name := range names {
		owned, err := s.isSecureValueOwnedByResource(ctx, owner, name)
		if err != nil {
			return fmt.Errorf("error checking if secure value %s is owned by %v: %w", name, owner, err)
		}

		if owned {
			if _, err := s.secureValueService.Delete(ctx, xkube.Namespace(owner.Namespace), name); err != nil {
				return fmt.Errorf("error deleting secure value %s for owner %v: %w", name, owner, err)
			}
		}
	}

	return nil
}
