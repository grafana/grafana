package util

import (
	"regexp"

	"github.com/teris-io/shortid"
)

var allowedChars = shortid.DefaultABC

var validUidPattern = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`).MatchString

func init() {
	gen, _ := shortid.New(1, allowedChars, 1)
	shortid.SetDefault(gen)
}

// IsValidShortUid checks if short unique identifier contains valid characters
func IsValidShortUid(uid string) bool {
	return validUidPattern(uid)
}

// GenerateShortUid generates a short unique identifier.
func GenerateShortUid() string {
	return shortid.MustGenerate()
}
