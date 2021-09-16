package util

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAllowedCharMatchesUidPattern(t *testing.T) {
	for _, c := range allowedChars {
		if !IsValidShortUID(string(c)) {
			t.Fatalf("charset for creating new shortids contains chars not present in uid pattern")
		}
	}
}

func TestIsShortUIDTooLong(t *testing.T) {
	var tests = []struct {
		name     string
		uid      string
		expected bool
	}{
		{
			name:     "when the length of uid is longer than 40 chars then IsShortUIDTooLong should return true",
			uid:      allowedChars,
			expected: true,
		},
		{
			name:     "when the length of uid is equal too 40 chars then IsShortUIDTooLong should return false",
			uid:      "0123456789012345678901234567890123456789",
			expected: false,
		},
		{
			name:     "when the length of uid is shorter than 40 chars then IsShortUIDTooLong should return false",
			uid:      "012345678901234567890123456789012345678",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, IsShortUIDTooLong(tt.uid))
		})
	}
}
