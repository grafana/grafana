package tokens

import (
	"fmt"

	"github.com/google/uuid"
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
