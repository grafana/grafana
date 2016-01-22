package util

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"io"

	"github.com/grafana/grafana/pkg/log"
)

func Decrypt(payload []byte, secret string) []byte {
	key := encryptionKeyToBytes(secret)

	block, err := aes.NewCipher(key)
	if err != nil {
		log.Fatal(4, err.Error())
	}

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	if len(payload) < aes.BlockSize {
		log.Fatal(4, "payload too short")
	}
	iv := payload[:aes.BlockSize]
	payload = payload[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payload, payload)
	return payload
}

func Encrypt(payload []byte, secret string) []byte {
	key := encryptionKeyToBytes(secret)

	block, err := aes.NewCipher(key)
	if err != nil {
		log.Fatal(4, err.Error())
	}

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, aes.BlockSize+len(payload))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		log.Fatal(4, err.Error())
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], payload)

	return ciphertext
}

// Key needs to be 32bytes
func encryptionKeyToBytes(secret string) []byte {
	key := make([]byte, 32, 32)
	keyBytes := []byte(secret)
	secretLength := len(keyBytes)
	for i := 0; i < 32; i++ {
		if secretLength > i {
			key[i] = keyBytes[i]
		} else {
			key[i] = 0
		}
	}
	return key
}
