package util

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/quotedprintable"
	"strings"

	legacypbkdf2 "golang.org/x/crypto/pbkdf2"
)

const alphanum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// GetRandomString generates a random alphanumeric string of the specified length,
// optionally using only specified characters
func GetRandomString(n int, alphabets ...byte) (string, error) {
	chars := alphanum
	if len(alphabets) > 0 {
		chars = string(alphabets)
	}
	cnt := len(chars)
	max := 255 / cnt * cnt

	bytes := make([]byte, n)

	randread := n * 5 / 4
	randbytes := make([]byte, randread)

	for i := 0; i < n; {
		if _, err := rand.Read(randbytes); err != nil {
			return "", err
		}

		for j := 0; i < n && j < randread; j++ {
			b := int(randbytes[j])
			if b >= max {
				continue
			}

			bytes[i] = chars[b%cnt]
			i++
		}
	}

	return string(bytes), nil
}

// EncodePassword encodes a password using PBKDF2.
func EncodePassword(password string, salt string) (string, error) {
	newPasswd, err := pbkdf2.Key(sha256.New, password, []byte(salt), 10000, 50)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(newPasswd), nil
}

// GeneratePasswordSalt generates a FIPS-compliant 16-byte
// random salt encoded as a hex string for DB storage.
// Uses crypto/rand to meet NIST SP 800-132 §5.1 requirements.
func GeneratePasswordSalt() (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("failed to generate salt: %w", err)
	}
	return hex.EncodeToString(salt), nil
}

// EncodePasswordLegacy encodes a password using the pure-Go
// PBKDF2 implementation from golang.org/x/crypto/pbkdf2.
// This bypasses FIPS enforcement and is used ONLY to verify
// passwords hashed with legacy short salts (< 16 bytes).
// After successful verification, the caller must re-hash the
// password with EncodePassword and a new compliant salt.
// See: GitHub issue #120561
func EncodePasswordLegacy(password string, salt string) (string, error) {
	newPasswd := legacypbkdf2.Key(
		[]byte(password),
		[]byte(salt),
		10000,
		50,
		sha256.New,
	)
	return hex.EncodeToString(newPasswd), nil
}

// GetBasicAuthHeader returns a base64 encoded string from user and password.
func GetBasicAuthHeader(user string, password string) string {
	var userAndPass = user + ":" + password
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(userAndPass))
}

// DecodeBasicAuthHeader decodes user and password from a basic auth header.
func DecodeBasicAuthHeader(header string) (string, string, error) {
	var code string
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && parts[0] == "Basic" {
		code = parts[1]
	}

	decoded, err := base64.StdEncoding.DecodeString(code)
	if err != nil {
		return "", "", err
	}

	userAndPass := strings.SplitN(string(decoded), ":", 2)
	if len(userAndPass) != 2 {
		return "", "", errors.New("invalid basic auth header")
	}

	return userAndPass[0], userAndPass[1], nil
}

// RandomHex returns a hex encoding of n random bytes.
func RandomHex(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// decodeQuotedPrintable decodes quoted-printable UTF-8 string
func DecodeQuotedPrintable(encodedValue string) string {
	decodedBytes, err := io.ReadAll(quotedprintable.NewReader(strings.NewReader(encodedValue)))
	if err != nil {
		return encodedValue
	}
	return string(decodedBytes)
}
