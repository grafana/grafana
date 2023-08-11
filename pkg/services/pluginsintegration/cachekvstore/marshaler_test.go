package cachekvstore

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestJSONMarshaler(t *testing.T) {
	t.Run("marshal", func(t *testing.T) {
		var value struct {
			A string `json:"a"`
			B string `json:"b"`
		}
		m := NewJSONMarshaler(&value)
		expV, err := json.Marshal(value)
		require.NoError(t, err)
		v, err := m.Marshal()
		require.NoError(t, err)
		require.Equal(t, string(expV), v)
	})
}

func TestMarshal(t *testing.T) {
	t.Run("marshaler", func(t *testing.T) {
		var value struct {
			A string `json:"a"`
			B string `json:"b"`
		}

		// NewJSONMarshaler returns a Marshaler interface
		mv := NewJSONMarshaler(&value)

		// We know that JSONMarshaler uses json.Marshal under the hood...
		expV, err := json.Marshal(value)
		require.NoError(t, err)

		v, err := Marshal(mv)
		require.NoError(t, err)
		require.Equal(t, string(expV), v)
	})

	t.Run("string", func(t *testing.T) {
		v, err := Marshal("value")
		require.NoError(t, err)
		require.Equal(t, "value", v)
	})

	t.Run("stringer", func(t *testing.T) {
		var s stringer
		v, err := Marshal(s)
		require.NoError(t, err)
		require.Equal(t, s.String(), v)
	})

	t.Run("byte slice", func(t *testing.T) {
		v, err := Marshal([]byte("value"))
		require.NoError(t, err)
		require.Equal(t, "value", v)
	})

	t.Run("unsupported type", func(t *testing.T) {
		_, err := Marshal(nil)
		require.Error(t, err)
	})
}

type stringer struct{}

func (s stringer) String() string {
	return "aaaa"
}
