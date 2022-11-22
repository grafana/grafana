package tokens

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/util"
)

// GenerateAccessToken generates an uuid formatted without dashes to use as access token
func GenerateAccessToken() (string, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", token[:]), nil
}

// IsValidAccessToken asserts that an accessToken is a valid uuid
func IsValidAccessToken(token string) bool {
	_, err := uuid.Parse(token)
	return err == nil
}

// IsValidShortUID checks that the uid is not blank and contains valid
// characters. Wraps utils.IsValidShortUID
func IsValidShortUID(uid string) bool {
	return uid != "" && util.IsValidShortUID(uid)
}
