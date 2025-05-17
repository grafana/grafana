package provider

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"errors"

	"github.com/grafana/grafana/pkg/services/encryption"
)

type aesDecipher struct {
	algorithm string
}

func (d aesDecipher) Decrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	if len(payload) < encryption.SaltLength {
		return nil, errors.New("unable to compute salt")
	}

	salt := payload[:encryption.SaltLength]
	key, err := encryption.KeyToBytes(secret, string(salt))
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	switch d.algorithm {
	case encryption.AesGcm:
		return decryptGCM(block, payload)
	default:
		return decryptCFB(block, payload)
	}
}

func decryptGCM(block cipher.Block, payload []byte) ([]byte, error) {
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := payload[encryption.SaltLength : encryption.SaltLength+gcm.NonceSize()]
	ciphertext := payload[encryption.SaltLength+gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func decryptCFB(block cipher.Block, payload []byte) ([]byte, error) {
	// The IV needs to be unique, but not secure. Therefore, it's common to
	// include it at the beginning of the ciphertext.
	if len(payload) < aes.BlockSize {
		return nil, errors.New("payload too short")
	}

	iv := payload[encryption.SaltLength : encryption.SaltLength+aes.BlockSize]
	payload = payload[encryption.SaltLength+aes.BlockSize:]
	payloadDst := make([]byte, len(payload))

	//nolint:staticcheck
	stream := cipher.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payloadDst, payload)
	return payloadDst, nil
}
