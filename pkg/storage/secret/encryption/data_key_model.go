package encryption

import (
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// SecretDataKey does not have a mirrored K8s resource
type SecretDataKey struct {
	UID           string
	Active        bool
	Namespace     string
	Label         string
	Provider      contracts.EncryptionProvider
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}
