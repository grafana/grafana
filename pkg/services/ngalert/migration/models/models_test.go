package models

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util"
)

func TestDeduplicator(t *testing.T) {
	tc := []struct {
		name            string
		maxLen          int
		caseInsensitive bool
		input           []string
		expected        []string
		expectedState   map[string]struct{}
	}{
		{
			name:            "when case insensitive, it deduplicates case-insensitively",
			caseInsensitive: true,
			input:           []string{"a", "A", "B", "b", "a", "A", "b", "B"},
			expected:        []string{"a", "A #2", "B", "b #2", "a #3", "A #4", "b #3", "B #4"},
		},
		{
			name:            "when case sensitive, it deduplicates case-sensitively",
			caseInsensitive: false,
			input:           []string{"a", "A", "B", "b", "a", "A", "b", "B"},
			expected:        []string{"a", "A", "B", "b", "a #2", "A #2", "b #2", "B #2"},
		},
		{
			name:     "when maxLen is 0, it does not truncate",
			maxLen:   0,
			input:    []string{strings.Repeat("a", 1000), strings.Repeat("a", 1000)},
			expected: []string{strings.Repeat("a", 1000), strings.Repeat("a", 1000) + " #2"},
		},
		{
			name:            "when maxLen is > 0, it truncates - caseInsensitive",
			caseInsensitive: true,
			maxLen:          10,
			input:           []string{strings.Repeat("A", 15), strings.Repeat("a", 15), strings.Repeat("A", 15)},
			expected:        []string{strings.Repeat("A", 10), strings.Repeat("a", 7) + " #2", strings.Repeat("A", 7) + " #3"},
		},
		{
			name:     "when maxLen is > 0, it truncates - caseSensitive",
			maxLen:   10,
			input:    []string{strings.Repeat("A", 15), strings.Repeat("a", 15), strings.Repeat("A", 15)},
			expected: []string{strings.Repeat("A", 10), strings.Repeat("a", 10), strings.Repeat("A", 7) + " #2"},
		},
		{
			name:            "when truncate causes collision, it deduplicates - caseInsensitive",
			caseInsensitive: true,
			maxLen:          10,
			input:           []string{strings.Repeat("A", 15), strings.Repeat("a", 10), strings.Repeat("b", 15), strings.Repeat("B", 10)},
			expected:        []string{strings.Repeat("A", 10), strings.Repeat("a", 7) + " #2", strings.Repeat("b", 10), strings.Repeat("B", 7) + " #2"},
		},
		{
			name:     "when truncate causes collision, it deduplicates - caseSensitive",
			maxLen:   10,
			input:    []string{strings.Repeat("A", 15), strings.Repeat("A", 10)},
			expected: []string{strings.Repeat("A", 10), strings.Repeat("A", 7) + " #2"},
		},
		{
			name:            "when deduplicate causes collision, it deduplicates - caseInsensitive",
			caseInsensitive: true,
			maxLen:          10,
			input:           []string{"A", "a", "a #2", "b", "B", "B #2"},
			expected:        []string{"A", "a #2", "a #2 #2", "b", "B #2", "B #2 #2"},
		},
		{
			name:     "when deduplicate causes collision, it deduplicates - caseSensitive",
			maxLen:   10,
			input:    []string{"a", "a", "a #2", "b", "b", "b #2"},
			expected: []string{"a", "a #2", "a #2 #2", "b", "b #2", "b #2 #2"},
		},
		{
			name:            "when deduplicate causes collision, it finds next available increment - caseInsensitive",
			caseInsensitive: true,
			maxLen:          10,
			input:           []string{"a", "A #2", "a #3", "A #4", "a #5", "A #6", "a #7", "A #8", "a #9", "A #10", "a"},
			expected:        []string{"a", "A #2", "a #3", "A #4", "a #5", "A #6", "a #7", "A #8", "a #9", "A #10", "a #11"},
		},
		{
			name:     "when deduplicate causes collision, it finds next available increment - caseSensitive",
			maxLen:   10,
			input:    []string{"a", "a #2", "a #3", "a #4", "a #5", "a #6", "a #7", "a #8", "a #9", "a #10", "a"},
			expected: []string{"a", "a #2", "a #3", "a #4", "a #5", "a #6", "a #7", "a #8", "a #9", "a #10", "a #11"},
		},
		{
			name:            "when deduplicate causes collision enough times, it deduplicates with uid - caseInsensitive",
			caseInsensitive: true,
			maxLen:          10,
			input:           []string{"a", "A #2", "a #3", "A #4", "a #5", "A #6", "a #7", "A #8", "a #9", "A #10", "a #11", "A"},
			expected:        []string{"a", "A #2", "a #3", "A #4", "a #5", "A #6", "a #7", "A #8", "a #9", "A #10", "a #11", "A_uid-1"},
		},
		{
			name:     "when deduplicate causes collision enough times, it deduplicates with uid - caseSensitive",
			maxLen:   10,
			input:    []string{"a", "a #2", "a #3", "a #4", "a #5", "a #6", "a #7", "a #8", "a #9", "a #10", "a #11", "a"},
			expected: []string{"a", "a #2", "a #3", "a #4", "a #5", "a #6", "a #7", "a #8", "a #9", "a #10", "a #11", "a_uid-1"},
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			inc := 0
			mockUidGenerator := func() string {
				inc++
				return fmt.Sprintf("uid-%d", inc)
			}
			dedup := Deduplicator{
				set:             make(map[string]int),
				caseInsensitive: tt.caseInsensitive,
				maxLen:          tt.maxLen,
				uidGenerator:    mockUidGenerator,
			}
			out := make([]string, 0, len(tt.input))
			for _, in := range tt.input {
				d, err := dedup.Deduplicate(in)
				require.NoError(t, err)
				out = append(out, d)
			}
			require.Equal(t, tt.expected, out)
		})
	}
}

func Test_shortUIDCaseInsensitiveConflicts(t *testing.T) {
	s := Deduplicator{
		set:             make(map[string]int),
		caseInsensitive: true,
	}

	// 10000 uids seems to be enough to cause a collision in almost every run if using util.GenerateShortUID directly.
	for i := 0; i < 10000; i++ {
		s.add(util.GenerateShortUID(), 0)
	}

	// check if any are case-insensitive duplicates.
	deduped := make(map[string]struct{})
	for k := range s.set {
		deduped[strings.ToLower(k)] = struct{}{}
	}

	require.Equal(t, len(s.set), len(deduped))
}
