package tokens

import (
	"fmt"

	"github.com/google/uuid"
)

// generates a uuid formatted without dashes to use as access token
func GenerateAccessToken() (string, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", token[:]), nil
}

// asserts that an accessToken is a valid uuid
func IsValidAccessToken(token string) bool {
	_, err := uuid.Parse(token)
	return err == nil
}
