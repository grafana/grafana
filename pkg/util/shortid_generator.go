package util

import (
	"math/rand"
	"regexp"
	"time"

	"github.com/google/uuid"
)

var uidrand = rand.New(rand.NewSource(time.Now().UnixNano()))
var alphaRunes = []rune("abcdefghijklmnopqrstuvwxyz")

// Legacy UID pattern
var validUIDPattern = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`).MatchString

// IsValidShortUID checks if short unique identifier contains valid characters
// NOTE: future Grafana UIDs will need conform to https://github.com/kubernetes/apimachinery/blob/master/pkg/util/validation/validation.go#L43
func IsValidShortUID(uid string) bool {
	return validUIDPattern(uid)
}

// IsShortUIDTooLong checks if short unique identifier is too long
func IsShortUIDTooLong(uid string) bool {
	return len(uid) > 40
}

// GenerateShortUID generates a short unique identifier.
// This will return a valid k8s name
func GenerateShortUID() string {
	uid, err := uuid.NewRandom()
	if err != nil {
		panic("invalid uuid")
	}
	uuid := uid.String()
	return string(alphaRunes[uidrand.Intn(len(alphaRunes))]) + // alpha
		uuid[0:8] + // time_low
		uuid[9:13] + // time_mid
		uuid[19:22] + // Clock sequence + variant
		uuid[28:] // Node
}
