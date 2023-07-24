package util

import (
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
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

		_, err := uuid.Parse(v)
		require.NoError(t, err)

		//fmt.Println(v)
	}
	// t.FailNow()
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
