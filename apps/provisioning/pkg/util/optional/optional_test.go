package optional

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNonZero(t *testing.T) {
	require.Nil(t, NonZero(""))
	require.Nil(t, NonZero(int64(0)))
	require.Nil(t, NonZero(false))
	require.Equal(t, "a", *NonZero("a"))
	require.Equal(t, int64(-1), *NonZero(int64(-1)))
	require.True(t, *NonZero(true))
}

func TestClearZero(t *testing.T) {
	type nested struct {
		Flag *bool
		Name *string
	}
	type object struct {
		Count  *int64
		Text   *string
		Value  string
		Nested nested
		Ptr    *nested
	}
	obj := object{
		Count:  new(int64(0)),
		Text:   new("kept"),
		Value:  "",
		Nested: nested{Flag: new(false), Name: new("n")},
		Ptr:    &nested{Flag: new(true), Name: new("")},
	}
	ClearZero(&obj)
	require.Equal(t, object{
		Text:   new("kept"),
		Nested: nested{Name: new("n")},
		Ptr:    &nested{Flag: new(true)},
	}, obj)
}
