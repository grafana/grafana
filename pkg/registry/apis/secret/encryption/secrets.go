package encryption

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

const UsageInsightsPrefix = "secrets_manager"

// EncryptionProvider is a key encryption key provider for envelope encryption
type EncryptionProvider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

func KeyLabel(provider contracts.EncryptionProvider) string {
	return fmt.Sprintf("%s@%s", time.Now().Format("2006-01-02"), provider)
}

// BackgroundProvider should be implemented for a provider that has a task that needs to be run in the background.
type BackgroundProvider interface {
	Run(ctx context.Context) error
}
