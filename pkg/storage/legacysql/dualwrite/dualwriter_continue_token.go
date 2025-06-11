package dualwrite

import (
	"encoding/base64"
	"fmt"
	"strings"
)

// parseContinueTokens splits a dualwriter continue token (legacy, unified) if we received one.
// If we received a single token that is not separated by a comma, we return the token as is as legacy
// token and an empty unified token. This is to ensure smooth transition to the new token format.
func parseContinueTokens(token string) (string, string, error) {
	if token == "" {
		return "", "", nil
	}
	decodedToken, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return "", "", fmt.Errorf("failed to decode dualwriter continue token: %w", err)
	}
	decodedTokens := strings.Split(string(decodedToken), ",")
	if len(decodedTokens) > 1 {
		return decodedTokens[0], decodedTokens[1], nil
	}
	return token, "", nil

}
