// Package pattoken generates and validates personal access tokens.
//
// Tokens look like glpat_<secret>_<checksum>. Only the SHA-256 of the secret is
// ever stored; the secret is high-entropy so a slow KDF is not needed.
package pattoken

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"hash/crc32"
	"math/big"
	"regexp"
	"strings"
)

const (
	Prefix       = "glpat_"
	secretLength = 43 // ~256 bits of entropy with a base62 alphabet
	checksumLen  = 8

	alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

	// HintLength is the number of trailing token characters safe to show in UIs.
	HintLength = 4

	redacted = "glpat_[REDACTED]"
)

// ErrInvalidToken is intentionally the only validation error so callers cannot
// build an oracle out of the failure reason.
var ErrInvalidToken = errors.New("invalid personal access token")

var tokenPattern = regexp.MustCompile(`glpat_[0-9A-Za-z]+(?:_[0-9a-f]+)?`)

type Token struct {
	// Secret is the plaintext token, shown to the user exactly once.
	Secret string
	// Hash is the value to persist and look tokens up by.
	Hash string
	// Hint is the last characters of the token, for display only.
	Hint string
}

// New generates a fresh token.
func New() (Token, error) {
	secret, err := randomSecret(secretLength)
	if err != nil {
		return Token{}, err
	}
	full := Prefix + secret + "_" + checksum(secret)
	return Token{Secret: full, Hash: HashSecret(secret), Hint: full[len(full)-HintLength:]}, nil
}

// Parse validates the format and checksum of a token and returns the hash used
// for the store lookup. It performs no I/O.
func Parse(token string) (hash string, err error) {
	if !strings.HasPrefix(token, Prefix) {
		return "", ErrInvalidToken
	}
	rest := token[len(Prefix):]
	if len(rest) != secretLength+1+checksumLen || rest[secretLength] != '_' {
		return "", ErrInvalidToken
	}
	secret, sum := rest[:secretLength], rest[secretLength+1:]
	for _, c := range secret {
		if !strings.ContainsRune(alphabet, c) {
			return "", ErrInvalidToken
		}
	}
	if subtle.ConstantTimeCompare([]byte(sum), []byte(checksum(secret))) != 1 {
		return "", ErrInvalidToken
	}
	return HashSecret(secret), nil
}

// HasPrefix reports whether s looks like a personal access token, so that the
// authn pipeline can select the right client.
func HasPrefix(s string) bool {
	return strings.HasPrefix(s, Prefix)
}

func HashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// EqualHash compares two hashes in constant time.
func EqualHash(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// Redact replaces any personal access token found in s, for use in logs and errors.
func Redact(s string) string {
	return tokenPattern.ReplaceAllString(s, redacted)
}

func checksum(secret string) string {
	c := crc32.ChecksumIEEE([]byte(Prefix + secret))
	return hex.EncodeToString([]byte{byte(c >> 24), byte(c >> 16), byte(c >> 8), byte(c)})
}

func randomSecret(n int) (string, error) {
	max := big.NewInt(int64(len(alphabet)))
	b := make([]byte, n)
	for i := range b {
		v, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = alphabet[v.Int64()]
	}
	return string(b), nil
}
