package encryption

import "context"

// This is a service that only manages encrypting and decrypting data.
// Copies the interface from: https://pkg.go.dev/gocloud.dev@v0.40.0/secrets#Keeper, specially for remote encryption/decryption.
// It could also be a "local" encryption implementation, say a private/public key pair defined in the config that is used instead.
type EncryptionService interface {
	Encrypt(ctx context.Context, plaintext []byte) (ciphertext []byte, err error)
	Decrypt(ctx context.Context, ciphertext []byte) (plaintext []byte, err error)
}
