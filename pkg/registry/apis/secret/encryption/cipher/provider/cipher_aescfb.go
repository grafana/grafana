package provider

import (
	"context"
	"crypto/aes"
	cpr "crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/util"
)

type aesCfbCipher struct{}

func (c aesCfbCipher) Encrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	salt, err := util.GetRandomString(cipher.SaltLength)
	if err != nil {
		return nil, err
	}

	key, err := cipher.KeyToBytes(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	// The IV needs to be unique, but not secure. Therefore, it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, cipher.SaltLength+aes.BlockSize+len(payload))
	copy(ciphertext[:cipher.SaltLength], salt)
	iv := ciphertext[cipher.SaltLength : cipher.SaltLength+aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	stream := cpr.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[cipher.SaltLength+aes.BlockSize:], payload)

	return ciphertext, nil
}
