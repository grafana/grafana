package util

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/pbkdf2"
)

const (
	saltLength                   = 8
	aesCfb                       = "aes-cfb"
	aesGcm                       = "aes-gcm"
	encryptionAlgorithmDelimiter = '*'
)

// Decrypt decrypts a payload with a given secret.
// DEPRECATED. Do not use it.
// Use secrets.Service instead.
func Decrypt(payload []byte, secret string) ([]byte, error) {
	alg, payload, err := deriveEncryptionAlgorithm(payload)
	if err != nil {
		return nil, err
	}

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
	case aesGcm:
		return decryptGCM(block, payload)
	default:
		return decryptCFB(block, payload)
	}
}

func deriveEncryptionAlgorithm(payload []byte) (string, []byte, error) {
	if len(payload) == 0 {
		return "", nil, fmt.Errorf("unable to derive encryption algorithm")
	}

	if payload[0] != encryptionAlgorithmDelimiter {
		return aesCfb, payload, nil // backwards compatibility
	}

	payload = payload[1:]
	algDelim := bytes.Index(payload, []byte{encryptionAlgorithmDelimiter})
	if algDelim == -1 {
		return aesCfb, payload, nil // backwards compatibility
	}

	algB64 := payload[:algDelim]
	payload = payload[algDelim+1:]

	alg := make([]byte, base64.RawStdEncoding.DecodedLen(len(algB64)))

	_, err := base64.RawStdEncoding.Decode(alg, algB64)
	if err != nil {
		return "", nil, err
	}

	return string(alg), payload, nil
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

	//nolint:staticcheck // SA1019: We're not changing away from CFB in older versions
	stream := cipher.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(payloadDst, payload)
	return payloadDst, nil
}

// Encrypt encrypts a payload with a given secret.
// DEPRECATED. Do not use it.
// Use secrets.Service instead.
func Encrypt(payload []byte, secret string) ([]byte, error) {
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

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, saltLength+aes.BlockSize+len(payload))
	copy(ciphertext[:saltLength], salt)
	iv := ciphertext[saltLength : saltLength+aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	//nolint:staticcheck // SA1019: We're not changing away from CFB in older versions
	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[saltLength+aes.BlockSize:], payload)

	return ciphertext, nil
}

// Key needs to be 32bytes
func encryptionKeyToBytes(secret, salt string) ([]byte, error) {
	return pbkdf2.Key([]byte(secret), []byte(salt), 10000, 32, sha256.New), nil
}
