package dualwrite

import (
	"encoding/base64"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// parseContinueTokens splits a dualwriter continue token (legacy, unified) if we received one.
// If we receive a single token not separated by a comma, we return the token as-is as a legacy
// token and an empty unified token. This is to ensure a smooth transition to the new token format.
func parseContinueTokens(token string) (string, string, error) {
	if token == "" {
		return "", "", nil
	}
	decodedToken, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return "", "", apierrors.NewBadRequest(fmt.Sprintf("failed to decode dualwriter continue token: %v", err))
	}
	decodedTokens := strings.Split(string(decodedToken), ",")
	if len(decodedTokens) > 2 || (len(decodedTokens) == 2 && decodedTokens[0] == "" && decodedTokens[1] == "") {
		return "", "", apierrors.NewBadRequest("invalid dualwriter continue token")
	}
	if len(decodedTokens) == 2 {
		return decodedTokens[0], decodedTokens[1], nil
	}
	return token, "", nil
}

func buildContinueToken(legacyToken, unifiedToken string) string {
	if legacyToken == "" && unifiedToken == "" {
		return ""
	}
	return base64.StdEncoding.EncodeToString([]byte(
		strings.Join([]string{legacyToken, unifiedToken}, ",")))
}
