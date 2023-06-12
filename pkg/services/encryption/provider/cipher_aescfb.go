package provider

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/util"
)

type aesCfbCipher struct{}

func (c aesCfbCipher) Encrypt(_ context.Context, payload []byte, secret string) ([]byte, error) {
	salt, err := util.GetRandomString(encryption.SaltLength)
	if err != nil {
		return nil, err
	}

	key, err := encryption.KeyToBytes(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	// The IV needs to be unique, but not secure. Therefore, it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, encryption.SaltLength+aes.BlockSize+len(payload))
	copy(ciphertext[:encryption.SaltLength], salt)
	iv := ciphertext[encryption.SaltLength : encryption.SaltLength+aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[encryption.SaltLength+aes.BlockSize:], payload)

	return ciphertext, nil
}
