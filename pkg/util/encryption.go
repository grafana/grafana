package util

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const saltLength = 8

const (
	AesGcm = "aes-gcm"
	AesCfb = "aes-cfb"
)

func Decrypt(payload []byte, secret, alg string) ([]byte, error) {
	if len(payload) < saltLength {
		return nil, fmt.Errorf("unable to compute salt")
	}

	salt := payload[:saltLength]
	key, err := encryptionKeyToBytes(secret, string(salt))
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	switch alg {
	case AesGcm:
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

	nonce := payload[saltLength : saltLength+gcm.NonceSize()]
	ciphertext := payload[saltLength+gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

func decryptCFB(block cipher.Block, payload []byte) ([]byte, error) {
	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	if len(payload) < aes.BlockSize {
		return nil, errors.New("payload too short")
	}

	iv := payload[saltLength : saltLength+aes.BlockSize]
	payload = payload[saltLength+aes.BlockSize:]
	payloadDst := make([]byte, len(payload))

	stream := cipher.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payloadDst, payload)
	return payloadDst, nil
}

func Encrypt(payload []byte, secret string, alg string) ([]byte, error) {
	salt, err := GetRandomString(saltLength)
	if err != nil {
		return nil, err
	}

	key, err := encryptionKeyToBytes(secret, salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	switch alg {
	case AesGcm:
		return encryptGCM(block, payload, salt)
	default:
		return encryptCFB(block, payload, salt)
	}
}

func encryptGCM(block cipher.Block, payload []byte, salt string) ([]byte, error) {
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, payload, nil)

	result := make([]byte, saltLength+gcm.NonceSize()+len(ciphertext))

	copy(result[:saltLength], salt)
	copy(result[saltLength:saltLength+gcm.NonceSize()], nonce)
	copy(result[saltLength+gcm.NonceSize():], ciphertext)

	return result, nil
}

func encryptCFB(block cipher.Block, payload []byte, salt string) ([]byte, error) {
	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, saltLength+aes.BlockSize+len(payload))
	copy(ciphertext[:saltLength], salt)

	iv := ciphertext[saltLength : saltLength+aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[saltLength+aes.BlockSize:], payload)
	return ciphertext, nil
}

// Key needs to be 32bytes
func encryptionKeyToBytes(secret, salt string) ([]byte, error) {
	return pbkdf2.Key([]byte(secret), []byte(salt), 10000, 32, sha256.New), nil
}
