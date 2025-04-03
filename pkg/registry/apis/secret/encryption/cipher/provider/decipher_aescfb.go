package provider

import (
	"context"
	"crypto/aes"
	cpr "crypto/cipher"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

const cfbSaltLength = 8

var _ cipher.Decrypter = aesCfbDecipher{}

type aesCfbDecipher struct{}

func (aesCfbDecipher) Decrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	// payload is formatted:
	// Salt       Nonce          Encrypted
	// |            |             Payload
	// |            |                |
	// |  +---------v-------------+  |
	// +-->SSSSSSSNNNNNNNEEEEEEEEE<--+
	//    +-----------------------+

	if len(payload) < cfbSaltLength+aes.BlockSize {
		// If we don't return here, we'd panic.
		return nil, ErrPayloadTooShort
	}

	salt := payload[:cfbSaltLength]

	key, err := aes256CipherKey(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	iv, payload := payload[cfbSaltLength:][:aes.BlockSize], payload[cfbSaltLength+aes.BlockSize:]
	payloadDst := make([]byte, len(payload))

	//nolint:staticcheck // We need to support CFB _decryption_, though we don't support it for future encryption.
	stream := cpr.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payloadDst, payload)
	return payloadDst, nil
}
