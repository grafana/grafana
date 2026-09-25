package search

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCursorRoundTrip(t *testing.T) {
	for _, offset := range []int64{1, 40, 1 << 40} {
		got, err := decodeCursor(encodeCursor(offset))
		require.NoError(t, err, "offset %d", offset)
		assert.Equal(t, offset, got)
	}
}

// The token is opaque, so nothing a client could plausibly guess or corrupt may
// be read as a position in the result set.
func TestDecodeCursorRejectsTokensItDidNotIssue(t *testing.T) {
	for name, token := range map[string]string{
		"plain integer":      "40",
		"negative integer":   "-1",
		"not base64":         "!!!",
		"base64 non-numeric": base64.RawURLEncoding.EncodeToString([]byte("nope")),
		"encodes zero":       encodeCursor(0),
		"encodes negative":   encodeCursor(-1),
	} {
		t.Run(name, func(t *testing.T) {
			_, err := decodeCursor(token)
			require.Error(t, err)
		})
	}
}

func TestDecodeCursorEmptyTokenStartsAtZero(t *testing.T) {
	got, err := decodeCursor("")
	require.NoError(t, err)
	assert.Zero(t, got)
}
