package util

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"mime/quotedprintable"
	"strings"
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
