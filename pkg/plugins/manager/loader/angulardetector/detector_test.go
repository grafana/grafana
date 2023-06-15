package angulardetector

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainsBytesDetector(t *testing.T) {
	detector := &containsBytesDetector{pattern: []byte("needle")}
	t.Run("contains", func(t *testing.T) {
		require.True(t, detector.Detect([]byte("lorem needle ipsum haystack")))
	})
	t.Run("not contains", func(t *testing.T) {
		require.False(t, detector.Detect([]byte("ippif")))
	})
}

func TestRegexDetector(t *testing.T) {
	detector := &regexDetector{regex: regexp.MustCompile("hello world(?s)")}
	for _, tc := range []struct {
		name string
		s    string
		exp  bool
	}{
		{name: "match 1", s: "hello world", exp: true},
		{name: "match 2", s: "bla bla hello world bla bla", exp: true},
		{name: "match 3", s: "bla bla hello worlds bla bla", exp: true},
		{name: "no match", s: "bla bla hello you reading this test code", exp: false},
	} {
		t.Run(tc.s, func(t *testing.T) {
			r := detector.Detect([]byte(tc.s))
			require.Equal(t, tc.exp, r, "detector result should be correct")
		})
	}
}
