package util

import (
	"errors"
)

var ErrNotInitialized = errors.New("function is not initialized")

// Decrypt decrypts a payload with a given secret.
// Real implementation in github.com/grafana/grafana/pkg/services/secrets
var Decrypt = func(_ []byte) ([]byte, error) {
	return nil, ErrNotInitialized
}

// Encrypt encrypts a payload with a given secret.
// Real implementation in github.com/grafana/grafana/pkg/services/secrets
var Encrypt = func(_ []byte) ([]byte, error) {
	return nil, ErrNotInitialized
}
