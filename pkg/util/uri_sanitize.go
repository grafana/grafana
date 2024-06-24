package util

import (
	"fmt"
	"net/url"
	"strings"
)

const masking = "hidden"

var sensitiveQueryChecks = map[string]func(key string, urlValues url.Values) bool{
	"auth_token": func(key string, urlValues url.Values) bool {
		return true
	},
	"x-amz-signature": func(key string, urlValues url.Values) bool {
		return true
	},
	"x-goog-signature": func(key string, urlValues url.Values) bool {
		return true
	},
	"sig": func(key string, urlValues url.Values) bool {
		for k := range urlValues {
			if strings.ToLower(k) == "sv" {
				return true
			}
		}
		return false
	},
}

func SanitizeURI(s string) (string, error) {
	if s == "" {
		return s, nil
	}

	u, err := url.ParseRequestURI(s)
	if err != nil {
		return "", fmt.Errorf("failed to sanitize URL")
	}

	// strip out sensitive query strings
	urlValues := u.Query()
	for key := range urlValues {
		lk := strings.ToLower(key)
		if checker, ok := sensitiveQueryChecks[lk]; ok {
			if checker(key, urlValues) {
				urlValues.Set(key, masking)
			}
		}
	}
	u.RawQuery = urlValues.Encode()

	return u.String(), nil
}
