package util

import (
	"regexp"

	"github.com/teris-io/shortid"
)

var allowedChars = shortid.DefaultABC

var validUIDPattern = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`).MatchString

func init() {
	gen, _ := shortid.New(1, allowedChars, 1)
	shortid.SetDefault(gen)
}

// IsValidShortUID checks if short unique identifier contains valid characters
func IsValidShortUID(uid string) bool {
	return validUIDPattern(uid)
}

// GenerateShortUID generates a short unique identifier.
func GenerateShortUID() string {
	return shortid.MustGenerate()
}
