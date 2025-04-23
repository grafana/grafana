package secret

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

// TODO: find a better name
type SecretService struct {
	accessClient               claims.AccessClient
	database                   contracts.Database
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	outboxQueue                contracts.OutboxQueue
}

func ProvideSecretService(
	accessClient claims.AccessClient,
	database contracts.Database,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	outboxQueue contracts.OutboxQueue) *SecretService {
	return &SecretService{
		accessClient:               accessClient,
		database:                   database,
		secureValueMetadataStorage: secureValueMetadataStorage,
		outboxQueue:                outboxQueue,
	}
}

func (s *SecretService) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	// TODO: check permissions?
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	// hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
	// 	Group:     secretv0alpha1.GROUP,
	// 	Resource:  secretv0alpha1.SecureValuesResourceInfo.GetName(),
	// 	Namespace: namespace.String(),
	// 	Verb:      utils.VerbGet, // Why not VerbList?
	// })
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to compile checker: %w", err)
	// }
	// if !hasPermissionFor(row.Name, "") {

	var out *secretv0alpha1.SecureValue

	if err := s.database.Transaction(ctx, func(ctx context.Context) error {
		createdSecureValue, err := s.secureValueMetadataStorage.Create(ctx, sv, authInfo.GetUID())
		if err != nil {
			return fmt.Errorf("failed to create securevalue: %w", err)
		}
		out = createdSecureValue

		if _, err := s.outboxQueue.Append(ctx, contracts.AppendOutboxMessage{
			Type:      contracts.CreateSecretOutboxMessage,
			Name:      sv.Name,
			Namespace: sv.Namespace,
			// TODO: encrypt
			EncryptedSecret: sv.Spec.Value,
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

func (s *SecretService) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	// TODO: check permissions?
	// _, ok := claims.AuthInfoFrom(ctx)
	// if !ok {
	// 	return nil, fmt.Errorf("missing auth info in context")
	// }

	return s.secureValueMetadataStorage.Read(ctx, namespace, name)
}

func (s *SecretService) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
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

	secureValuesMetadata, err := s.secureValueMetadataStorage.List(ctx, namespace, options)

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

func (s *SecretService) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, bool, error) {
	const updateIsSync = false

	// TODO: if updating requires communicating with external services, the secure value metadata status must be changed to Pending

	// TODO: check permissions?
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, updateIsSync, fmt.Errorf("missing auth info in context")
	}

	var out *secretv0alpha1.SecureValue

	if err := s.database.Transaction(ctx, func(ctx context.Context) error {
		// Current implementation replaces everything passed in the spec, so it is not a PATCH. Do we want/need to support that?
		updatedSecureValue, err := s.secureValueMetadataStorage.Update(ctx, newSecureValue, authInfo.GetUID())
		if err != nil {
			return fmt.Errorf("failed to update secure value: %w", err)
		}
		out = updatedSecureValue

		if _, err := s.outboxQueue.Append(ctx, contracts.AppendOutboxMessage{
			Type:      contracts.UpdateSecretOutboxMessage,
			Name:      updatedSecureValue.Name,
			Namespace: updatedSecureValue.Namespace,
			// TODO: encrypt
			EncryptedSecret: updatedSecureValue.Spec.Value,
			KeeperName:      updatedSecureValue.Spec.Keeper,
		}); err != nil {
			return fmt.Errorf("failed to append message to update secure value to outbox queue: %w", err)
		}

		return nil
	}); err != nil {
		return out, updateIsSync, err
	}

	return out, updateIsSync, nil
}

func (s *SecretService) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	// TODO: check permissions?

	sv, err := s.secureValueMetadataStorage.Read(ctx, namespace, name)
	if err != nil {
		return fmt.Errorf("fetching secure value: %+w", err)

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

	return nil
}
