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

func TestValue(t *testing.T) {
	require.Equal(t, "", Value[string](nil))
	require.Equal(t, int64(0), Value[int64](nil))
	require.False(t, Value[bool](nil))
	require.Equal(t, "a", Value(new("a")))
	require.Equal(t, int64(-1), Value(new(int64(-1))))
}

func TestClearZero(t *testing.T) {
	type nested struct {
		Flag     *bool   `json:"flag,omitempty"`
		Name     *string `json:"name,omitempty"`
		Nullable *string `json:"nullable"`
	}
	type object struct {
		Count   *int64    `json:"count,omitempty"`
		Text    *string   `json:"text,omitempty"`
		Value   string    `json:"value,omitempty"`
		Nested  nested    `json:"nested"`
		Ptr     *nested   `json:"ptr,omitempty"`
		List    []nested  `json:"list,omitempty"`
		PtrList []*nested `json:"ptrList,omitempty"`
		Names   []*string `json:"names,omitempty"`
	}
	obj := object{
		Count:   new(int64(0)),
		Text:    new("kept"),
		Value:   "",
		Nested:  nested{Flag: new(false), Name: new("n"), Nullable: new("")},
		Ptr:     &nested{Flag: new(true), Name: new("")},
		List:    []nested{{Flag: new(false), Name: new("a")}, {Name: new(""), Nullable: new("")}},
		PtrList: []*nested{nil, {Flag: new(false), Name: new("b")}},
		Names:   []*string{new(""), new("c")},
	}
	ClearZero(&obj)
	require.Equal(t, object{
		Text:    new("kept"),
		Nested:  nested{Name: new("n"), Nullable: new("")},
		Ptr:     &nested{Flag: new(true)},
		List:    []nested{{Name: new("a")}, {Nullable: new("")}},
		PtrList: []*nested{nil, {Name: new("b")}},
		Names:   []*string{new(""), new("c")},
	}, obj)
}
