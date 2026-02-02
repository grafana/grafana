package provider

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/util"
)

func gCMEncrypter(payload []byte, secret string) ([]byte, error) {

	salt, err := util.GetRandomString(encryption.SaltLength)
	if err != nil {
		return nil, err
	}

	key, err := encryption.KeyToBytes(secret, string(salt))
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		panic(err.Error())
	}

	encryptText := gcm.Seal(nil, nonce, payload, nil)

	ciphertext := make([]byte, encryption.SaltLength+gcm.NonceSize()+len(encryptText))
	copy(ciphertext[:encryption.SaltLength], salt)
	copy(ciphertext[encryption.SaltLength:encryption.SaltLength+gcm.NonceSize()], nonce)
	copy(ciphertext[encryption.SaltLength+gcm.NonceSize():], encryptText)

	return ciphertext, nil
}
