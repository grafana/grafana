package api

import (
	"strings"
)

// TextMatcher performs case-insensitive sequential substring matching.
// It checks if text contains all search words in the order provided,
// but not necessarily consecutively.
//
// Example: NewTextMatcher("api time").Match("API Response Time") returns true
type TextMatcher struct {
	words []string
}

func NewTextMatcher(search string) *TextMatcher {
	words := strings.Fields(search)
	for i := range words {
		words[i] = strings.ToLower(words[i])
	}
	return &TextMatcher{words: words}
}

func (m *TextMatcher) Match(text string) bool {
	if len(m.words) == 0 {
		return true
	}
	lowerText := strings.ToLower(text)
	start := 0
	for _, word := range m.words {
		if start > len(lowerText) {
			return false
		}
		idx := strings.Index(lowerText[start:], word)
		if idx == -1 {
			return false
		}
		start += idx + len(word)
	}
	return true
}
