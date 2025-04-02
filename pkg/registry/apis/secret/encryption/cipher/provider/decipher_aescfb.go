package provider

import (
	"context"
	"crypto/aes"
	cpr "crypto/cipher"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

var _ cipher.Decrypter = aesCfbDecipher{}

type aesCfbDecipher struct{}

func (aesCfbDecipher) Decrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	if len(payload) < cipher.SaltLength+aes.BlockSize {
		return nil, ErrPayloadTooShort
	}

	salt := payload[:cipher.SaltLength]

	key, err := cipher.KeyToBytes([]byte(secret), salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	iv, payload := payload[cipher.SaltLength:][:aes.BlockSize], payload[cipher.SaltLength+aes.BlockSize:]
	payloadDst := make([]byte, len(payload))

	//nolint:staticcheck // We need to support CFB _decryption_, though we don't support it for future encryption.
	stream := cpr.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payloadDst, payload)
	return payloadDst, nil
}
