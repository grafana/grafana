package api

import (
	"crypto/subtle"

	macaron "gopkg.in/macaron.v1"
)

// BasicAuthenticatedRequest parses the provided HTTP request for basic authentication credentials
// and returns true if the provided credentials match the expected username and password.
// Returns false if the request is unauthenticated.
// Uses constant-time comparison in order to mitigate timing attacks.
func BasicAuthenticatedRequest(req macaron.Request, expectedUser, expectedPass string) bool {
	user, pass, ok := req.BasicAuth()
	if !ok || subtle.ConstantTimeCompare([]byte(user), []byte(expectedUser)) != 1 || subtle.ConstantTimeCompare([]byte(pass), []byte(expectedPass)) != 1 {
		return false
	}

	return true
}
