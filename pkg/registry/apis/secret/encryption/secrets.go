package encryption

import (
	"context"
	"fmt"
	"strings"
	"time"
)

const UsageInsightsPrefix = "secrets_manager"

// Provider is a key encryption key provider for envelope encryption
type Provider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

type ProviderID string

func (id ProviderID) Kind() (string, error) {
	idStr := string(id)

	parts := strings.SplitN(idStr, ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("malformatted provider identifier %s: expected format <provider>.<keyName>", idStr)
	}

	return parts[0], nil
}

func KeyLabel(providerID ProviderID) string {
	return fmt.Sprintf("%s@%s", time.Now().Format("2006-01-02"), providerID)
}

type ProviderMap map[ProviderID]Provider

// ProvideThirdPartyProviderMap fulfills the wire dependency needed by the encryption manager in OSS
func ProvideThirdPartyProviderMap() ProviderMap {
	return ProviderMap{}
}

// BackgroundProvider should be implemented for a provider that has a task that needs to be run in the background.
type BackgroundProvider interface {
	Run(ctx context.Context) error
}
