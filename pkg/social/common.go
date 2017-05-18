package social

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func isEmailAllowed(email string, allowedDomains []string) bool {
	if len(allowedDomains) == 0 {
		return true
	}

	valid := false
	for _, domain := range allowedDomains {
		emailSuffix := fmt.Sprintf("@%s", domain)
		valid = valid || strings.HasSuffix(email, emailSuffix)
	}

	return valid
}

func jwtTokenScopes(token string) ([]string, error) {
	chunks := strings.Split(token, ".")
	if len(chunks) < 2 {
		return nil, errors.New("malformed token")
	}

	rawData := chunks[1]
	if l := len(rawData) % 4; l > 0 {
		rawData += strings.Repeat("=", 4-l)
	}

	tokenData, err := base64.URLEncoding.DecodeString(rawData)
	if err != nil {
		return nil, err
	}

	oauthToken := &struct {
		Scopes []string `json:"scope"`
	}{}

	if err := json.Unmarshal(tokenData, oauthToken); err != nil {
		return nil, err
	}

	return oauthToken.Scopes, nil
}
