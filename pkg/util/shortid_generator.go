package util

import (
	"errors"
	"regexp"

	"github.com/teris-io/shortid"
)

var allowedChars = shortid.DefaultABC

var validUidPattern = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`).MatchString

var ErrDashboardInvalidUid = errors.New("uid contains illegal characters")
var ErrDashboardUidToLong = errors.New("uid to long. max 40 characters")

func init() {
	gen, _ := shortid.New(1, allowedChars, 1)
	shortid.SetDefault(gen)
}

// VerifyUid verifies the size and content of the uid
func VerifyUid(uid string) error {
	if len(uid) > 40 {
		return ErrDashboardUidToLong
	}

	if !validUidPattern(uid) {
		return ErrDashboardInvalidUid
	}

	return nil
}

// GenerateShortUid generates a short unique identifier.
func GenerateShortUid() string {
	return shortid.MustGenerate()
}
