package secrets

import (
	"errors"
	"time"
)

var ErrDataKeyNotFound = errors.New("data key not found")

type DataKey struct {
	Active        bool
	Id            string `xorm:"name"` // renaming the col in the db itself would break backward compatibility with 8.5.x
	Label         string
	Scope         string
	Provider      ProviderID
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}

type EncryptionOptions func() string

// WithoutScope uses a root level data key for encryption (DEK),
// in other words this DEK is not bound to any specific scope (not attached to any user, org, etc.).
func WithoutScope() EncryptionOptions {
	return func() string {
		return "root"
	}
}

// WithScope uses a data key for encryption bound to some specific scope (i.e., user, org, etc.).
// Scope should look like "user:10", "org:1".
func WithScope(scope string) EncryptionOptions {
	return func() string {
		return scope
	}
}
