package service

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type SecureValueService struct {
	tracer                     trace.Tracer
	accessClient               claims.AccessClient
	database                   contracts.Database
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	outboxQueue                contracts.OutboxQueue
	encryptionManager          contracts.EncryptionManager
}

func ProvideSecureValueService(
	tracer trace.Tracer,
	accessClient claims.AccessClient,
	database contracts.Database,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	outboxQueue contracts.OutboxQueue,
	encryptionManager contracts.EncryptionManager,
) *SecureValueService {
	return &SecureValueService{
		tracer:                     tracer,
		accessClient:               accessClient,
		database:                   database,
		secureValueMetadataStorage: secureValueMetadataStorage,
		outboxQueue:                outboxQueue,
		encryptionManager:          encryptionManager,
	}
}

func (s *SecureValueService) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Create", trace.WithAttributes(
		attribute.String("name", sv.GetName()),
		attribute.String("namespace", sv.GetNamespace()),
		attribute.String("actor", actorUID),
	))
	defer span.End()

	sv.Status = secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhasePending, Message: "Creating secure value"}

	var out *secretv0alpha1.SecureValue

	encryptedSecret, err := s.encryptionManager.Encrypt(ctx, sv.Namespace, []byte(sv.Spec.Value.DangerouslyExposeAndConsumeValue()))
	if err != nil {
		return nil, fmt.Errorf("encrypting secure value secret: %w", err)
	}

	if err := s.database.Transaction(ctx, func(ctx context.Context) error {
		createdSecureValue, err := s.secureValueMetadataStorage.Create(ctx, sv, actorUID)
		if err != nil {
			return fmt.Errorf("failed to create securevalue: %w", err)
		}
		out = createdSecureValue

		if _, err := s.outboxQueue.Append(ctx, contracts.AppendOutboxMessage{
			RequestID:       contracts.GetRequestId(ctx),
			Type:            contracts.CreateSecretOutboxMessage,
			Name:            sv.Name,
			Namespace:       sv.Namespace,
			EncryptedSecret: string(encryptedSecret),
			KeeperName:      sv.Spec.Keeper,
		}); err != nil {
			return fmt.Errorf("failed to append message to create secure value to outbox queue: %w", err)
		}

		return nil
	}); err != nil {
		return out, err
	}

	return out, nil
}

func (s *SecureValueService) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Read", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	return s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: false})
}

func (s *SecureValueService) List(ctx context.Context, namespace xkube.Namespace) (*secretv0alpha1.SecureValueList, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.List", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
		Group:     secretv0alpha1.GROUP,
		Resource:  secretv0alpha1.SecureValuesResourceInfo.GetName(),
		Namespace: namespace.String(),
		Verb:      utils.VerbGet, // Why not VerbList?
	})
	if err != nil {
		return nil, fmt.Errorf("failed to compile checker: %w", err)
	}

	secureValuesMetadata, err := s.secureValueMetadataStorage.List(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("fetching secure values from storage: %+w", err)
	}

	out := make([]secretv0alpha1.SecureValue, 0)

	for _, metadata := range secureValuesMetadata {
		// Check whether the user has permission to access this specific SecureValue in the namespace.
		if !hasPermissionFor(metadata.Name, "") {
			continue
		}

		out = append(out, metadata)
	}

	return &secretv0alpha1.SecureValueList{
		Items: out,
	}, nil
}

func (s *SecureValueService) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, bool, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Create", trace.WithAttributes(
		attribute.String("name", newSecureValue.GetName()),
		attribute.String("namespace", newSecureValue.GetNamespace()),
		attribute.String("actor", actorUID),
	))
	defer span.End()

	// True when the effects of an update can be seen immediately.
	// Never true in this case since updating a secure value is async.
	const updateIsSync = false

	var (
		out             *secretv0alpha1.SecureValue
		encryptedSecret string
	)

	if newSecureValue.Spec.Value != "" {
		buffer, err := s.encryptionManager.Encrypt(ctx, newSecureValue.Namespace, []byte(newSecureValue.Spec.Value.DangerouslyExposeAndConsumeValue()))
		if err != nil {
			return nil, false, fmt.Errorf("encrypting secure value secret: %w", err)
		}
		encryptedSecret = string(buffer)
	}

	if err := s.database.Transaction(ctx, func(ctx context.Context) error {
		sv, err := s.secureValueMetadataStorage.Read(ctx, xkube.Namespace(newSecureValue.Namespace), newSecureValue.Name, contracts.ReadOpts{ForUpdate: true})
		if err != nil {
			return fmt.Errorf("fetching secure value: %+w", err)
		}

		if sv.Status.Phase == secretv0alpha1.SecureValuePhasePending {
			return contracts.ErrSecureValueOperationInProgress
		}

		// Succeed immediately if the value is not going to be updated
		if encryptedSecret == "" {
			newSecureValue.Status = secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhaseSucceeded}
		} else {
			newSecureValue.Status = secretv0alpha1.SecureValueStatus{
				Message: "Updating secure value",
				Phase:   secretv0alpha1.SecureValuePhasePending,
			}
		}

		// Current implementation replaces everything passed in the spec, so it is not a PATCH. Do we want/need to support that?
		updatedSecureValue, err := s.secureValueMetadataStorage.Update(ctx, newSecureValue, actorUID)
		if err != nil {
			return fmt.Errorf("failed to update secure value: %w", err)
		}
		out = updatedSecureValue

		// Only the value needs to be updated asynchronously by the outbox worker
		if encryptedSecret != "" {
			if _, err := s.outboxQueue.Append(ctx, contracts.AppendOutboxMessage{
				Type:            contracts.UpdateSecretOutboxMessage,
				Name:            newSecureValue.Name,
				Namespace:       newSecureValue.Namespace,
				EncryptedSecret: encryptedSecret,
				KeeperName:      newSecureValue.Spec.Keeper,
				ExternalID:      &updatedSecureValue.Status.ExternalID,
			}); err != nil {
				return fmt.Errorf("failed to append message to update secure value to outbox queue: %w", err)
			}
		}

		return nil
	}); err != nil {
		return out, updateIsSync, err
	}

	return out, updateIsSync, nil
}

func (s *SecureValueService) Delete(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SecureValueService.Delete", trace.WithAttributes(
		attribute.String("name", name),
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	// Set inside of the transaction callback
	var out *secretv0alpha1.SecureValue

	if err := s.database.Transaction(ctx, func(ctx context.Context) error {
		sv, err := s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{ForUpdate: true})
		if err != nil {
			return fmt.Errorf("fetching secure value: %+w", err)
		}

		if sv.Status.Phase == secretv0alpha1.SecureValuePhasePending {
			return contracts.ErrSecureValueOperationInProgress
		}

		sv.Status = secretv0alpha1.SecureValueStatus{Phase: secretv0alpha1.SecureValuePhasePending, Message: "Deleting secure value"}

		if err := s.secureValueMetadataStorage.SetStatus(ctx, namespace, name, sv.Status); err != nil {
			return fmt.Errorf("setting secure value status phase: %+w", err)
		}

		if _, err := s.outboxQueue.Append(ctx, contracts.AppendOutboxMessage{
			Type:       contracts.DeleteSecretOutboxMessage,
			Name:       name,
			Namespace:  namespace.String(),
			KeeperName: sv.Spec.Keeper,
			ExternalID: &sv.Status.ExternalID,
		}); err != nil {
			return fmt.Errorf("appending delete secure value message to outbox queue: %+w", err)
		}

		out = sv

		return nil
	}); err != nil {
		return out, err
	}

	return out, nil
}
