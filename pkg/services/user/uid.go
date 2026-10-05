package user

import (
	"crypto/sha256"
	"fmt"
	"math/big"
	"strings"
)

// GenerateDeterministicUID derives a user's UID from a hash of its natural key
// (namespace, email, login). Two concurrent create requests for the same
// (namespace, email, login) therefore resolve to the same UID, so the second one
// is rejected by the store's own uniqueness constraint instead of silently creating
// a duplicate user.
func GenerateDeterministicUID(namespace, email, login string) string {
	input := namespace + "\x00" + strings.ToLower(email) + "\x00" + strings.ToLower(login)
	h := sha256.Sum256([]byte(input))
	n := new(big.Int).SetBytes(h[:10]) // first 80 bits

	return fmt.Sprintf("%016s", n.Text(36))
}
