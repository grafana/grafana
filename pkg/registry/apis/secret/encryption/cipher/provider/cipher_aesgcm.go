package provider

import (
	"context"
	"crypto/aes"
	cpr "crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

const gcmSaltLength = 8

var (
	_ cipher.Encrypter = (*aesGcmCipher)(nil)
	_ cipher.Decrypter = (*aesGcmCipher)(nil)
)

type aesGcmCipher struct {
	// randReader is used to generate random bytes for the nonce.
	// This allows us to change out the entropy source for testing.
	randReader io.Reader
}

func newAesGcmCipher() aesGcmCipher {
	return aesGcmCipher{
		randReader: rand.Reader,
	}
}

func (c aesGcmCipher) Encrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	salt, err := c.readEntropy(gcmSaltLength)
	if err != nil {
		return nil, err
	}

	key, err := aes256CipherKey(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cpr.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce, err := c.readEntropy(gcm.NonceSize())
	if err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, payload, nil)

	// Salt       Nonce          Encrypted
	// |            |             Payload
	// |            |                |
	// |  +---------v-------------+  |
	// +-->SSSSSSSNNNNNNNEEEEEEEEE<--+
	//    +-----------------------+
	prefix := append(salt, nonce...)
	ciphertext = append(prefix, ciphertext...)

	return ciphertext, nil
}

func (c aesGcmCipher) Decrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	// The input payload looks like:
	// Salt       Nonce          Encrypted
	// |            |             Payload
	// |            |                |
	// |  +---------v-------------+  |
	// +-->SSSSSSSNNNNNNNEEEEEEEEE<--+
	//    +-----------------------+

	if len(payload) < gcmSaltLength {
		// If we don't return here, we'd panic.
		return nil, ErrPayloadTooShort
	}
	salt, payload := payload[:gcmSaltLength], payload[gcmSaltLength:]
	// Can't get nonce until we get a size from the AEAD interface.

	key, err := aes256CipherKey(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cpr.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(payload) < gcm.NonceSize() {
		// If we don't return here, we'd panic.
		return nil, ErrPayloadTooShort
	}
	nonce, payload := payload[:gcm.NonceSize()], payload[gcm.NonceSize():]

	return gcm.Open(nil, nonce, payload, nil)
}

func (c aesGcmCipher) readEntropy(n int) ([]byte, error) {
	entropy := make([]byte, n)
	if _, err := io.ReadFull(c.randReader, entropy); err != nil {
		return nil, err
	}
	return entropy, nil
}
