package util

import "testing"

func TestAllowedCharMatchesUidPattern(t *testing.T) {
	for _, c := range allowedChars {
		err := VerifyUid(string(c))
		if err != nil {
			t.Fatalf("charset for creating new shortids contains chars not present in uid pattern")
		}
	}
}
