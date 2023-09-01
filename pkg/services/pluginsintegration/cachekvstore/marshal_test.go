package cachekvstore

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMarshal(t *testing.T) {
	t.Run("json", func(t *testing.T) {
		// Other type (rather than string, []byte or fmt.Stringer) marshals to JSON.
		var value struct {
			A string `json:"a"`
			B string `json:"b"`
		}
		expV, err := json.Marshal(value)
		require.NoError(t, err)

		v, err := marshal(value)
		require.NoError(t, err)
		require.Equal(t, string(expV), v)
	})

	t.Run("string", func(t *testing.T) {
		v, err := marshal("value")
		require.NoError(t, err)
		require.Equal(t, "value", v)
	})

	t.Run("stringer", func(t *testing.T) {
		var s stringer
		v, err := marshal(s)
		require.NoError(t, err)
		require.Equal(t, s.String(), v)
	})

	t.Run("byte slice", func(t *testing.T) {
		v, err := marshal([]byte("value"))
		require.NoError(t, err)
		require.Equal(t, "value", v)
	})
}

type stringer struct{}

func (s stringer) String() string {
	return "aaaa"
}
