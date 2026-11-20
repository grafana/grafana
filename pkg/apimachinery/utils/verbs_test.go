package utils

import "testing"

func TestIsValidVerb(t *testing.T) {
	t.Parallel()

	for _, verb := range []string{
		VerbGet, VerbList, VerbWatch, VerbCreate, VerbUpdate, VerbPatch,
		VerbDelete, VerbDeleteCollection, VerbGetPermissions, VerbSetPermissions,
	} {
		if !IsValidVerb(verb) {
			t.Errorf("IsValidVerb(%q) = false, want true", verb)
		}
	}

	for _, verb := range []string{"", "read", "write", "GET", "unknown"} {
		if IsValidVerb(verb) {
			t.Errorf("IsValidVerb(%q) = true, want false", verb)
		}
	}
}
