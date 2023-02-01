package util

import (
	"math/rand"
	"regexp"
	"time"
)

var uidrand = rand.New(rand.NewSource(time.Now().UnixNano()))
var alphaRunes = []rune("abcdefghijklmnopqrstuvwxyz")
var alphaNumRunes = []rune("abcdefghijklmnopqrstuvwxyz0123456789")

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
	size := 14
	b := make([]rune, size)
	b[0] = alphaRunes[uidrand.Intn(len(alphaRunes))]
	b[size-1] = alphaRunes[uidrand.Intn(len(alphaRunes))]
	for i := 1; i < size-1; i++ {
		b[i] = alphaNumRunes[rand.Intn(len(alphaNumRunes))]
	}
	return string(b)
}
