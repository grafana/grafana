package encryption

import (
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

// SecretDataKey does not have a mirrored K8s resource
type SecretDataKey struct {
	UID           string
	Active        bool
	Namespace     string
	Label         string
	Provider      encryption.ProviderID
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}
