package v0alpha1

import "strings"

// EncodeName builds the deterministic AuthInfo object name for a (userUID, authModule) pair.
func EncodeName(userUID, authModule string) string {
	return userUID + "." + strings.ReplaceAll(authModule, "_", "-")
}

// DecodeName reverses EncodeName.
func DecodeName(name string) (userUID, authModule string, ok bool) {
	userUID, encodedModule, ok := strings.Cut(name, ".")
	if !ok {
		return "", "", false
	}
	return userUID, strings.ReplaceAll(encodedModule, "-", "_"), true
}
