package backfill

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncodeDecodeCursor_RoundTrip(t *testing.T) {
	encoded := encodeCursor("dashboards", "tok-42")
	require.NotEmpty(t, encoded)

	got, err := decodeCursor(encoded)
	require.NoError(t, err)
	assert.Equal(t, "dashboards", got.Resource)
	assert.Equal(t, "tok-42", got.Token)
}

func TestEncodeCursor_BothEmpty_ReturnsEmpty(t *testing.T) {
	// Empty cursor should serialize to "" so the column reads as
	// "no cursor" instead of `{"r":"","t":""}`.
	assert.Equal(t, "", encodeCursor("", ""))
}

func TestDecodeCursor_Empty_ReturnsZero(t *testing.T) {
	got, err := decodeCursor("")
	require.NoError(t, err)
	assert.Equal(t, jobCursor{}, got)
}

func TestDecodeCursor_Malformed_ReturnsError(t *testing.T) {
	_, err := decodeCursor("not-json")
	require.Error(t, err)
}
