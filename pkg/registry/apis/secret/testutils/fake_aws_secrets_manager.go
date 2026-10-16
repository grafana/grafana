package testutils

import (
	"context"
	"fmt"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// A mock of AWS secrets manager, used for testing.
type ModelAWSSecretsManager struct {
	secrets        map[string]entry
	alreadyDeleted map[string]bool
}

type entry struct {
	exposedValueOrRef string
	externalID        string
}

func NewModelSecretsManager() *ModelAWSSecretsManager {
	return &ModelAWSSecretsManager{
		secrets:        make(map[string]entry),
		alreadyDeleted: make(map[string]bool),
	}
}

func (m *ModelAWSSecretsManager) Store(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64, exposedValueOrRef string) (externalID contracts.ExternalID, err error) {
	if exposedValueOrRef == "" {
		return "", fmt.Errorf("failed to satisfy constraint: Member must have length greater than or equal to 1")
	}

	versionID := buildVersionID(namespace, name, version)
	if e, ok := m.secrets[versionID]; ok {
		// Ignore duplicated requests
		if e.exposedValueOrRef == exposedValueOrRef {
			return contracts.ExternalID(e.externalID), nil
		}

		// Tried to create a secret that already exists
		return "", fmt.Errorf("ResourceExistsException: The operation failed because the secret %+v already exists", versionID)
	}

	// First time creating the secret
	entry := entry{
		exposedValueOrRef: exposedValueOrRef,
		externalID:        "external-id",
	}
	m.secrets[versionID] = entry

	return contracts.ExternalID(entry.externalID), nil
}

// Used to simulate the creation of secrets in the 3rd party secret store
func (m *ModelAWSSecretsManager) Create(name, value string) {
	m.secrets[name] = entry{
		exposedValueOrRef: value,
		externalID:        fmt.Sprintf("external_id_%+v", value),
	}
}

func (m *ModelAWSSecretsManager) Expose(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64) (exposedValue secretv1beta1.ExposedSecureValue, err error) {
	versionID := buildVersionID(namespace, name, version)

	if m.deleted(versionID) {
		return "", fmt.Errorf("InvalidRequestException: You can't perform this operation on the secret because it was marked for deletion")
	}

	entry, ok := m.secrets[versionID]
	if !ok {
		return "", fmt.Errorf("ResourceNotFoundException: Secrets Manager can't find the specified secret")
	}

	return secretv1beta1.ExposedSecureValue(entry.exposedValueOrRef), nil
}

// TODO: this could be namespaced to make it more realistic
func (m *ModelAWSSecretsManager) RetrieveReference(ctx context.Context, _ secretv1beta1.KeeperConfig, ref string) (secretv1beta1.ExposedSecureValue, error) {
	entry, ok := m.secrets[ref]
	if !ok {
		return "", fmt.Errorf("ResourceNotFoundException: Secrets Manager can't find the specified secret")
	}
	return secretv1beta1.ExposedSecureValue(entry.exposedValueOrRef), nil
}

func (m *ModelAWSSecretsManager) Delete(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64) (err error) {
	versionID := buildVersionID(namespace, name, version)

	// Deleting a secret that existed at some point is idempotent
	if m.deleted(versionID) {
		return nil
	}

	// If the secret is being deleted for the first time
	if m.exists(versionID) {
		m.delete(versionID)
	}

	return nil
}

func (m *ModelAWSSecretsManager) deleted(versionID string) bool {
	return m.alreadyDeleted[versionID]
}

func (m *ModelAWSSecretsManager) exists(versionID string) bool {
	_, ok := m.secrets[versionID]
	return ok
}

func (m *ModelAWSSecretsManager) delete(versionID string) {
	m.alreadyDeleted[versionID] = true
	delete(m.secrets, versionID)
}

func buildVersionID(namespace xkube.Namespace, name string, version int64) string {
	return fmt.Sprintf("%s/%s/%d", namespace, name, version)
}
