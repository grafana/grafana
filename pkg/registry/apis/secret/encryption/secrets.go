package encryption

import (
	"context"
	"fmt"
	"strings"
	"time"
)

const UsageInsightsPrefix = "secrets_manager"

type ProviderConfig struct {
	CurrentProvider    ProviderID
	AvailableProviders ProviderMap
}

type ProviderMap map[ProviderID]Provider

// Provider is a fully configured key encryption key provider used for to encrypt and decrypt data keys for envelope encryption
type Provider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

type ProviderID string

// Kind returns the kind of the provider, e.g. "secret_key", "aws_kms", "azure_keyvault", "google_kms", "hashicorp_vault"
func (id ProviderID) Kind() (string, error) {
	idStr := string(id)

	parts := strings.SplitN(idStr, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("malformatted provider identifier %s: expected format <provider>.<keyName>", idStr)
	}

	return parts[0], nil
}

// KeyLabel returns a label for the data key that is unique to the current provider and today's date.
func KeyLabel(providerID ProviderID) string {
	return fmt.Sprintf("%s@%s", time.Now().Format("2006-01-02"), providerID)
}
