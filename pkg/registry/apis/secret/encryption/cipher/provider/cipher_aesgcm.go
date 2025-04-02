package provider

import (
	"context"
	"crypto/aes"
	cpr "crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

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
	salt, err := c.generateSalt()
	if err != nil {
		return nil, err
	}

	key, err := cipher.KeyToBytes([]byte(secret), salt)
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

	nonce, err := c.generateNonce(gcm)
	if err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, payload, nil)

	// Salt         Nonce          Encrypted
	// │              │             Payload
	// │              V               │
	// │  ┌───────────────────────┐   │
	// └►│SSSSSSSNNNNNNNEEEEEEEEE│◄─┘
	//    └───────────────────────┘
	prefix := append(salt, nonce...)
	ciphertext = append(prefix, ciphertext...)

	return ciphertext, nil
}

func (c aesGcmCipher) Decrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	// The input payload looks like:
	// Salt         Nonce          Encrypted
	// │              │             Payload
	// │              V               │
	// │  ┌───────────────────────┐   │
	// └►│SSSSSSSNNNNNNNEEEEEEEEE│◄─┘
	//    └───────────────────────┘
	if len(payload) < cipher.SaltLength {
		return nil, ErrPayloadTooShort
	}

	salt, payload := payload[:cipher.SaltLength], payload[cipher.SaltLength:]
	// Can't get nonce until we get a size from the AEAD interface.

	key, err := cipher.KeyToBytes([]byte(secret), salt)
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

	nonce, payload := payload[:gcm.NonceSize()], payload[gcm.NonceSize():]

	return gcm.Open(nil, nonce, payload, nil)
}

func (c aesGcmCipher) generateSalt() ([]byte, error) {
	salt := make([]byte, cipher.SaltLength)
	if _, err := io.ReadFull(c.randReader, salt); err != nil {
		return nil, err
	}
	return salt, nil
}

func (c aesGcmCipher) generateNonce(aead cpr.AEAD) ([]byte, error) {
	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(c.randReader, nonce); err != nil {
		return nil, err
	}
	return nonce, nil
}
