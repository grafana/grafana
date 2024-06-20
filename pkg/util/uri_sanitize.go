package util

import (
	"fmt"
	"net/url"
	"strings"
)

const masking = "hidden"

var sensitiveQueryChecks = map[string]func(v map[string]string) bool{
	"auth_token": func(v map[string]string) bool {
		if _, ok := v["auth_token"]; ok {
			return true
		}
		return false
	},
	"x-amz-signature": func(v map[string]string) bool {
		if _, ok := v["x-amz-signature"]; ok {
			return true
		}
		return false
	},
	"x-goog-signature": func(v map[string]string) bool {
		if _, ok := v["x-goog-signature"]; ok {
			return true
		}
		return false
	},
	"sig": func(v map[string]string) bool {
		if _, ok := v["sig"]; !ok {
			return false
		}
		if _, ok := v["sv"]; ok {
			return true
		}
		return false
	},
}

func lowerToKeyMap(values url.Values) map[string]string {
	lm := make(map[string]string)
	for key := range values {
		lm[strings.ToLower((key))] = key
	}
	return lm
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
	for key, values := range urlValues {
		if checker, ok := sensitiveQueryChecks[strings.ToLower(key)]; ok {
			if checker(values, urlValues) {
				urlValues.Set(key, masking)
			}
		}
	}
	u.RawQuery = urlValues.Encode()

	return u.String(), nil
}
