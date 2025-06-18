package provider

import (
	"crypto/pbkdf2"
	"crypto/sha256"
)

// aes256CipherKey is used to calculate a key for AES-256 blocks.
// It returns a key of 32 bytes, which causes aes.NewCipher to choose AES-256.
// The implementation is equal to that of the legacy secrets system.
// If this changes, we either need to rotate all encrypted secrets, or keep a fallback implementation (being this).
func aes256CipherKey(password string, salt []byte) ([]byte, error) {
	return pbkdf2.Key(sha256.New, password, salt, 10000, 32)
}
