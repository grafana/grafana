package util

import (
	"fmt"
	"sync"
	"testing"

	"cuelang.org/go/pkg/strings"
	"github.com/stretchr/testify/require"
	"github.com/teris-io/shortid"
	"k8s.io/apimachinery/pkg/util/validation"
)

func TestAllowedCharMatchesUidPattern(t *testing.T) {
	for _, c := range alphaRunes {
		if !IsValidShortUID(string(c)) {
			t.Fatalf("charset for creating new shortids contains chars not present in uid pattern")
		}
	}
}

// Run with "go test -race -run ^TestThreadSafe$ github.com/grafana/grafana/pkg/util"
func TestThreadSafe(t *testing.T) {
	// This test was used to showcase the bug, unfortunately there is
	// no way to enable the -race flag programmatically.
	t.Skip()
	// Use 1000 go routines to create 100 UIDs each at roughly the same time.
	var wg sync.WaitGroup
	for i := 0; i < 1000; i++ {
		go func() {
			for ii := 0; ii < 100; ii++ {
				_ = GenerateShortUID()
			}
			wg.Done()
		}()
		wg.Add(1)
	}
	wg.Wait()
}

func TestRandomUIDs(t *testing.T) {
	for i := 0; i < 100; i++ {
		v := GenerateShortUID()
		if !IsValidShortUID(v) {
			t.Fatalf("charset for creating new shortids contains chars not present in uid pattern")
		}
		validation := validation.IsQualifiedName(v)
		if validation != nil {
			t.Fatalf("created invalid name: %v", validation)
		}

		//	fmt.Println(v)
	}
	// t.FailNow()
}

func TestCaseInsensitiveCollisionsUIDs(t *testing.T) {
	history := make(map[string]bool, 0)
	for i := 0; i < 100000; i++ {
		v := GenerateShortUID()
		if false {
			v, _ = shortid.Generate() // collides in less then 500 iterations
		}

		lower := strings.ToLower(v)
		_, exists := history[lower]
		require.False(t, exists, fmt.Sprintf("already found: %s (index:%d)", v, i))

		history[lower] = true
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
			uid:      string(alphaRunes) + string(alphaRunes),
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

func TestValidateUID(t *testing.T) {
	var tests = []struct {
		name     string
		uid      string
		expected error
	}{
		{
			name:     "no error when string is of correct length",
			uid:      "f8cc010c-ee72-4681-89d2-d46e1bd47d33",
			expected: nil,
		},
		{
			name:     "error when string is empty",
			uid:      "",
			expected: ErrUIDEmpty,
		},
		{
			name:     "error when string is too long",
			uid:      strings.Repeat("1", MaxUIDLength+1),
			expected: ErrUIDTooLong,
		},
		{
			name:     "error when string has invalid characters",
			uid:      "f8cc010c.ee72.4681;89d2+d46e1bd47d33",
			expected: ErrUIDFormatInvalid,
		},
		{
			name:     "error when string has only whitespaces",
			uid:      " ",
			expected: ErrUIDFormatInvalid,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateUID(tt.uid)
			if tt.expected == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tt.expected)
			}
		})
	}
}
