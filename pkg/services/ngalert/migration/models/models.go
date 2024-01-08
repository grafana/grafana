package models

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

// MaxDeduplicationAttempts is the maximum number of attempts to try to deduplicate a string using any
// individual method, such as sequential index suffixes or uids.
const MaxDeduplicationAttempts = 10

// Deduplicator is a utility for deduplicating strings. It keeps track of the strings it has seen and appends a unique
// suffix to strings that have already been seen. It can optionally truncate strings before appending the suffix to
// ensure that the resulting string is not longer than maxLen.
// This implementation will first try to deduplicate via a sequential index suffix of the form " #2", " #3", etc.
// If after MaxIncrementDeduplicationAttempts attempts it still cannot find a unique string, it will generate a new
// unique uid and append that to the string.
type Deduplicator struct {
	set             map[string]int
	caseInsensitive bool
	maxLen          int
	uidGenerator    func() string
}

// NewDeduplicator creates a new deduplicator.
// caseInsensitive determines whether the string comparison should be case-insensitive.
// maxLen determines the maximum length of deduplicated strings. If the deduplicated string would be longer than
// maxLen, it will be truncated.
func NewDeduplicator(caseInsensitive bool, maxLen int, initial ...string) *Deduplicator {
	d := &Deduplicator{
		set:             make(map[string]int, len(initial)),
		caseInsensitive: caseInsensitive,
		maxLen:          maxLen,
		uidGenerator:    util.GenerateShortUID,
	}
	if len(initial) > 0 {
		for _, u := range initial {
			d.add(u, 0)
		}
	}
	return d
}

// Deduplicate returns a unique string based on the given base string. If the base string has not already been seen by
// this deduplicator, it will be returned as-is. If the base string has already been seen, a unique suffix will be
// appended to the base string to make it unique.
func (s *Deduplicator) Deduplicate(base string) (string, error) {
	if s.maxLen > 0 && len(base) > s.maxLen {
		base = base[:s.maxLen]
	}
	cnt, ok := s.contains(base)
	if !ok {
		s.add(base, 0)
		return base, nil
	}

	// Start at 2, so we get a, a_2, a_3, etc.
	for i := 2 + cnt; i < 2+cnt+MaxDeduplicationAttempts; i++ {
		dedup := s.appendSuffix(base, fmt.Sprintf(" #%d", i))
		if _, ok := s.contains(dedup); !ok {
			s.add(dedup, 0)
			return dedup, nil
		}
	}

	// None of the simple suffixes worked, so we generate a new uid. We try a few times, just in case, but this should
	// almost always create a unique string on the first try.
	for i := 0; i < MaxDeduplicationAttempts; i++ {
		dedup := s.appendSuffix(base, fmt.Sprintf("_%s", s.uidGenerator()))
		if _, ok := s.contains(dedup); !ok {
			s.add(dedup, 0)
			return dedup, nil
		}
	}

	return "", fmt.Errorf("failed to deduplicate %q", base)
}

// contains checks whether the given string has already been seen by this deduplicator.
func (s *Deduplicator) contains(u string) (int, bool) {
	dedup := u
	if s.caseInsensitive {
		dedup = strings.ToLower(dedup)
	}
	if s.maxLen > 0 && len(dedup) > s.maxLen {
		dedup = dedup[:s.maxLen]
	}
	cnt, seen := s.set[dedup]
	return cnt, seen
}

// appendSuffix appends the given suffix to the given base string. If the resulting string would be longer than maxLen,
// the base string will be truncated.
func (s *Deduplicator) appendSuffix(base, suffix string) string {
	if s.maxLen > 0 && len(base)+len(suffix) > s.maxLen {
		return base[:s.maxLen-len(suffix)] + suffix
	}
	return base + suffix
}

// add adds the given string to the deduplicator.
func (s *Deduplicator) add(uid string, cnt int) {
	dedup := uid
	if s.caseInsensitive {
		dedup = strings.ToLower(dedup)
	}
	s.set[dedup] = cnt
}
