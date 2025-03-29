package provider

import (
	"context"
	"crypto/aes"
	cpr "crypto/cipher"
	"errors"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type aesDecipher struct {
	algorithm string
}

func (d aesDecipher) Decrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	if len(payload) < cipher.SaltLength {
		return nil, errors.New("unable to compute salt")
	}

	salt := payload[:cipher.SaltLength]
	key, err := cipher.KeyToBytes(secret, string(salt))
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	switch d.algorithm {
	case cipher.AesGcm:
		return decryptGCM(block, payload)
	default:
		return decryptCFB(block, payload)
	}
}

func decryptGCM(block cpr.Block, payload []byte) ([]byte, error) {
	gcm, err := cpr.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := payload[cipher.SaltLength : cipher.SaltLength+gcm.NonceSize()]
	ciphertext := payload[cipher.SaltLength+gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func decryptCFB(block cpr.Block, payload []byte) ([]byte, error) {
	// The IV needs to be unique, but not secure. Therefore, it's common to
	// include it at the beginning of the ciphertext.
	if len(payload) < aes.BlockSize {
		return nil, errors.New("payload too short")
	}

	iv := payload[cipher.SaltLength : cipher.SaltLength+aes.BlockSize]
	payload = payload[cipher.SaltLength+aes.BlockSize:]
	payloadDst := make([]byte, len(payload))

	stream := cpr.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payloadDst, payload)
	return payloadDst, nil
}
