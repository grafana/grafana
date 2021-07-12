package util

import (
	"errors"
)

var ErrNotInitialized = errors.New("function is not initialized")

// Decrypt decrypts a payload with a given secret.
var Decrypt = func(_ []byte) ([]byte, error) {
	return nil, ErrNotInitialized
}

// Encrypt encrypts a payload with a given secret.
var Encrypt = func(_ []byte) ([]byte, error) {
	return nil, ErrNotInitialized
}
