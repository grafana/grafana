package util

import (
	"errors"
)

var ErrNotInitialized = errors.New("function is not initialized")

type EncryptionOption func() string

// WithScope uses a data key for encryption bound to some specific scope (i.e., user, org, etc.).
// Scope should look like "user:10", "org:1".
func WithScope(scope string) EncryptionOption {
	return func() string {
		return scope
	}
}

// WithoutScope uses a root level data key for encryption (DEK),
// in other words this DEK is not bound to any specific scope (not attached to any user, org, etc.).
func WithoutScope() EncryptionOption {
	return func() string {
		return "root"
	}
}

// Decrypt decrypts a payload with a given secret.
var Decrypt = func(_ []byte) ([]byte, error) {
	return nil, ErrNotInitialized
}

// Encrypt encrypts a payload with a given secret.
var Encrypt = func(_ []byte, opt EncryptionOption) ([]byte, error) {
	return nil, ErrNotInitialized
}
