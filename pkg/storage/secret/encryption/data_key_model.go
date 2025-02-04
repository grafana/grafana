package encryption

import (
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

// SecretDataKey does not have a mirrored K8s resource
type SecretDataKey struct {
	UID           string                `xorm:"pk 'uid'"`
	Active        bool                  `xorm:"active"`
	Namespace     string                `xorm:"namespace"`
	Label         string                `xorm:"label"`
	Scope         string                `xorm:"scope"`
	Provider      encryption.ProviderID `xorm:"provider"`
	EncryptedData []byte                `xorm:"encrypted_data"`
	Created       time.Time             `xorm:"created"`
	Updated       time.Time             `xorm:"updated"`
}
