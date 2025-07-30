package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/util"
)

type inlineSecureValueService struct {
	tracer            trace.Tracer
	svService         contracts.SecureValueService
	svMetadataStorage contracts.SecureValueMetadataStorage
	accessChecker     authlib.AccessChecker
}

func ProvideInlineSecureValueService(
	tracer trace.Tracer,
	svService contracts.SecureValueService,
	svMetadataStorage contracts.SecureValueMetadataStorage,
	accessClient authlib.AccessClient,
) contracts.InlineSecureValueSupport {
	return &inlineSecureValueService{
		tracer:            tracer,
		svService:         svService,
		svMetadataStorage: svMetadataStorage,
		accessChecker:     accessClient,
	}
}

func (s *inlineSecureValueService) CanReference(ctx context.Context, owner common.ObjectReference, values common.InlineSecureValues) error {
	ctx, span := s.tracer.Start(ctx, "InlineSecureValueService.CanReference", trace.WithAttributes(
		attribute.String("namespace", owner.Namespace),
		attribute.String("ownerReference.APIGroup", owner.APIGroup),
		attribute.String("ownerReference.APIVersion", owner.APIVersion),
		attribute.String("ownerReference.Kind", owner.Kind),
		attribute.String("ownerReference.Name", owner.Name),
		attribute.String("ownerReference.UID", string(owner.UID)),
		attribute.Int("values.count", len(values)),
	))
	defer span.End()

	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	if owner.Namespace == "" || !authlib.NamespaceMatches(authInfo.GetNamespace(), owner.Namespace) {
		return fmt.Errorf("owner namespace %s does not match auth info namespace %s", owner.Namespace, authInfo.GetNamespace())
	}

	ownerReference := owner.ToOwnerReference()
	if ownerReference.APIVersion == "" || ownerReference.Kind == "" || ownerReference.Name == "" || ownerReference.UID == "" {
		return fmt.Errorf("owner reference must have a valid API version, kind, name, and UID")
	}

	// TODO(2025-07-29): return error here or not?
	if len(values) == 0 {
		return fmt.Errorf("no inline secure values provided")
	}

	for field, value := range values {
		if value.Name == "" {
			return fmt.Errorf("field %s has an empty secure value name", field)
		}

		if !value.Create.IsZero() {
			return fmt.Errorf("field %s has 'create' set, which is not allowed", field)
		}

		if value.Remove {
			return fmt.Errorf("field %s has 'remove' set, which is not allowed", field)
		}

		owned, err := s.secureValueOwnedByResource(ctx, ownerReference, xkube.Namespace(owner.Namespace), value.Name, field)
		if err != nil {
			return err
		}

		if !owned {
			if err := s.canIdentityReadSecureValue(ctx, xkube.Namespace(owner.Namespace), value.Name, field); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *inlineSecureValueService) UpdateSecureValues(ctx context.Context, owner common.ObjectReference, values common.InlineSecureValues) (common.InlineSecureValues, error) {
	ctx, span := s.tracer.Start(ctx, "InlineSecureValueService.UpdateSecureValues", trace.WithAttributes(
		attribute.String("namespace", owner.Namespace),
		attribute.String("ownerReference.APIGroup", owner.APIGroup),
		attribute.String("ownerReference.APIVersion", owner.APIVersion),
		attribute.String("ownerReference.Kind", owner.Kind),
		attribute.String("ownerReference.Name", owner.Name),
		attribute.String("ownerReference.UID", string(owner.UID)),
		attribute.Int("values.count", len(values)),
	))
	defer span.End()

	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return common.InlineSecureValues{}, fmt.Errorf("missing auth info in context")
	}

	// TODO(2025-07-29): what will the service identity look like when the request comes?
	serviceIdentityList, ok := authInfo.GetExtra()[authn.ServiceIdentityKey]
	if !ok || len(serviceIdentityList) != 1 {
		return nil, fmt.Errorf("expected exactly one service identity, found %d", len(serviceIdentityList))
	}
	serviceIdentity := serviceIdentityList[0]

	if owner.Namespace == "" || !authlib.NamespaceMatches(authInfo.GetNamespace(), owner.Namespace) {
		return nil, fmt.Errorf("owner namespace %s does not match auth info namespace %s", owner.Namespace, authInfo.GetNamespace())
	}

	ownerReference := owner.ToOwnerReference()
	if ownerReference.APIVersion == "" || ownerReference.Kind == "" || ownerReference.Name == "" || ownerReference.UID == "" {
		return nil, fmt.Errorf("owner reference must have a valid API version, kind, name, and UID")
	}

	fieldsToCreate := make([]string, 0)
	fieldsToRemove := make([]string, 0)
	fieldsCanBeReferenced := make([]string, 0)

	newState := make(common.InlineSecureValues, 0)

	for field, value := range values {
		// Explicitly create a new one (create=true remove=false name=false)
		if !value.Create.IsZero() && !value.Remove && value.Name == "" {
			fieldsToCreate = append(fieldsToCreate, field)
			continue
		}

		// Expliclty remove an existing one (create=false remove=true name=sv-name)
		// We'll check before that this is owned by the resource.
		if value.Remove && value.Name != "" && value.Create.IsZero() {
			fieldsToRemove = append(fieldsToRemove, field)
			continue
		}

		// Referencing a secure value that is already created (create=false remove=false name=sv-name)
		// We'll check that this is either owned by the resource, or if shared, that the identity can read it.
		if value.Name != "" && value.Create.IsZero() && !value.Remove {
			fieldsCanBeReferenced = append(fieldsCanBeReferenced, field)
			continue
		}

		return nil, fmt.Errorf(
			"unsupported combination of values for field %s: create=%v name=%v remove=%v",
			field, !value.Create.IsZero(), value.Name != "", value.Remove,
		)
	}

	for _, field := range fieldsToCreate {
		value, ok := values[field]
		if !ok {
			return nil, fmt.Errorf("bug found: field %s not found in values", field)
		}

		if value.Name != "" {
			return nil, fmt.Errorf("bug found: field %s has 'name' set but for creation it must not", field)
		}

		// TODO(2025-07-29): when we migrate to using the common type, we don't need this conversion.
		secret := secretv1beta1.NewExposedSecureValue(value.Create.DangerouslyExposeAndConsumeValue())

		spec := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:            field + "-" + util.GenerateShortUID(),
				Namespace:       owner.Namespace,
				OwnerReferences: []metav1.OwnerReference{ownerReference},
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: fmt.Sprintf(
					"Inline secure value for field %s in %s/%s/%s",
					field, ownerReference.APIVersion, ownerReference.Kind, ownerReference.Name,
				),
				Value: &secret,
				Decrypters: []string{
					serviceIdentity,
				},
			},
		}

		createdSv, err := s.svService.Create(ctx, spec, authInfo.GetUID())
		if err != nil {
			return nil, fmt.Errorf("error creating secure value %s for field %s: %w", spec.Name, field, err)
		}

		newState[field] = common.InlineSecureValue{
			Name: createdSv.Name,
		}
	}

	for _, field := range fieldsToRemove {
		value, ok := values[field]
		if !ok {
			return nil, fmt.Errorf("bug found: field %s not found in values", field)
		}

		if value.Name == "" {
			return nil, fmt.Errorf("bug found: field %s has 'remove' set but no secure value name provided", field)
		}

		owned, err := s.secureValueOwnedByResource(ctx, ownerReference, xkube.Namespace(owner.Namespace), value.Name, field)
		if err != nil {
			return nil, err
		}

		if !owned {
			return nil, fmt.Errorf("field %s tried to delete secure value %s which is not owned by the resource", field, value.Name)
		}

		if _, err := s.svService.Delete(ctx, xkube.Namespace(owner.Namespace), value.Name); err != nil {
			return nil, fmt.Errorf("error deleting secure value %s for field %s: %w", value.Name, field, err)
		}
	}

	for _, field := range fieldsCanBeReferenced {
		value, ok := values[field]
		if !ok {
			return nil, fmt.Errorf("bug found: field %s not found in values", field)
		}

		if value.Name == "" {
			return nil, fmt.Errorf("bug found: field %s has no secure value name provided", field)
		}

		owned, err := s.secureValueOwnedByResource(ctx, ownerReference, xkube.Namespace(owner.Namespace), value.Name, field)
		if err != nil {
			return nil, err
		}

		if !owned {
			if err := s.canIdentityReadSecureValue(ctx, xkube.Namespace(owner.Namespace), value.Name, field); err != nil {
				return nil, err
			}
		}

		newState[field] = common.InlineSecureValue{
			Name: value.Name,
		}
	}

	return newState, nil
}

func (s *inlineSecureValueService) secureValueOwnedByResource(
	ctx context.Context,
	ownerReference metav1.OwnerReference,
	namespace xkube.Namespace,
	name, field string,
) (bool, error) {
	sv, err := s.svService.Read(ctx, namespace, name)
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNotFound) {
			return false, fmt.Errorf("secure value %s not found in field %s", name, field)
		}

		return false, fmt.Errorf("error reading secure value %s in field %s: %w", name, field, err)
	}

	secureValueOwner := sv.GetOwnerReferences()
	if len(secureValueOwner) == 1 {
		sameOwner := ownerReference.APIVersion == secureValueOwner[0].APIVersion && ownerReference.Kind == secureValueOwner[0].Kind &&
			ownerReference.Name == secureValueOwner[0].Name && ownerReference.UID == secureValueOwner[0].UID
		if sameOwner {
			return true, nil // The secure value is owned by the same owner reference, pass!
		}

		return false, fmt.Errorf("field %s has secure value %s which is not owned by %v", field, name, ownerReference)
	}

	if len(secureValueOwner) > 1 {
		return false, fmt.Errorf("bug found: field has %s secure value %s with multiple owners, expected only one", field, name)
	}

	// not owned
	return false, nil
}

func (s *inlineSecureValueService) canIdentityReadSecureValue(ctx context.Context, namespace xkube.Namespace, name, field string) error {
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	// If the secure value is shared, we always need a user/svc account in the context.
	// TODO(2025-07-29): check if this is the correct way to get the info.
	subject := authInfo.GetSubject()
	identityType, _, found := strings.Cut(subject, ":")
	if !found || (identityType != authlib.TypeUser.String() && identityType != authlib.TypeServiceAccount.String()) {
		return fmt.Errorf("subject %s does not have a valid identity type, expected either %s or %s", subject, authlib.TypeUser, authlib.TypeServiceAccount)
	}

	resp, err := s.accessChecker.Check(ctx, authInfo, authlib.CheckRequest{
		Verb:      utils.VerbGet,
		Group:     secretv1beta1.APIGroup,
		Resource:  secretv1beta1.SecureValuesResourceInfo.GroupResource().Resource,
		Namespace: namespace.String(),
		Name:      name,
	})
	if err != nil {
		return fmt.Errorf("error checking access for inline secure value %s in field %s: %w", name, field, err)
	}

	if !resp.Allowed {
		return fmt.Errorf("subject %s is not allowed to reference inline secure value %s in field %s", subject, name, field)
	}

	return nil
}
