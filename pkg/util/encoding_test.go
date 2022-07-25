package util

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetBasicAuthHeader_Encoding(t *testing.T) {
	t.Run("generating base64 header", func(t *testing.T) {
		result := GetBasicAuthHeader("grafana", "1234")
		assert.Equal(t, "Basic Z3JhZmFuYToxMjM0", result)
	})

	t.Run("decoding basic auth header", func(t *testing.T) {
		header := GetBasicAuthHeader("grafana", "1234")
		username, password, err := DecodeBasicAuthHeader(header)
		require.NoError(t, err)

		assert.Equal(t, "grafana", username)
		assert.Equal(t, "1234", password)
	})
}

func TestEncodePassword(t *testing.T) {
	encodedPassword, err := EncodePassword("iamgod", "pepper")
	require.NoError(t, err)
	assert.Equal(
		t,
		"e59c568621e57756495a468f47c74e07c911b037084dd464bb2ed72410970dc849cabd71b48c394faf08a5405dae53741ce9",
		encodedPassword,
	)
}

func TestDecodeQuotedPrintable(t *testing.T) {
	t.Run("should return not encoded string as is", func(t *testing.T) {
		testStrings := []struct {
			in  string
			out string
		}{
			{"", ""},
			{"munich", "munich"},
			{" munich", " munich"},
			{"munich gothenburg", "munich gothenburg"},
			{"München", "München"},
			{"München Göteborg", "München Göteborg"},
		}

		for _, str := range testStrings {
			val := DecodeQuotedPrintable(str.in)
			assert.Equal(t, str.out, val)
		}
	})

	t.Run("should decode encoded string", func(t *testing.T) {
		testStrings := []struct {
			in  string
			out string
		}{
			{"M=C3=BCnchen", "München"},
			{"M=C3=BCnchen G=C3=B6teborg", "München Göteborg"},
			{"=E5=85=AC=E5=8F=B8", "公司"},
		}

		for _, str := range testStrings {
			val := DecodeQuotedPrintable(str.in)
			assert.Equal(t, str.out, val)
		}
	})

	t.Run("should preserve meaningful whitespace", func(t *testing.T) {
		testStrings := []struct {
			in  string
			out string
		}{
			{"  ", ""},
			{"  =", "  "},
			{" munich  gothenburg", " munich  gothenburg"},
			{" munich  gothenburg  ", " munich  gothenburg"},
			{" munich  gothenburg  =", " munich  gothenburg  "},
			{" munich\tgothenburg\t \t", " munich\tgothenburg"},
			{" munich\t gothenburg\t \t=", " munich\t gothenburg\t \t"},
		}

		for _, str := range testStrings {
			val := DecodeQuotedPrintable(str.in)
			assert.Equal(t, str.out, val)
		}
	})

	t.Run("should gracefully ignore invalid encoding sequences", func(t *testing.T) {
		testStrings := []struct {
			in  string
			out string
		}{
			{"=XY=ZZ", "=XY=ZZ"},
			{"==58", "=X"},
			{"munich = gothenburg", "munich = gothenburg"},
			{"munich == tromso", "munich == tromso"},
		}

		for _, str := range testStrings {
			val := DecodeQuotedPrintable(str.in)
			assert.Equal(t, str.out, val)
		}
	})

	t.Run("should return invalid UTF-8 sequences as is", func(t *testing.T) {
		testStrings := []struct {
			in  string
			out string
		}{
			{"=E5 =85=AC =E5=8F =B8", "\xE5 \x85\xAC \xE5\x8F \xB8"},
			{"=00=00munich=FF=FF", "\x00\x00munich\xFF\xFF"},
		}

		for _, str := range testStrings {
			val := DecodeQuotedPrintable(str.in)
			assert.Equal(t, str.out, val)
		}
	})

	t.Run("should support long strings", func(t *testing.T) {
		str_in := strings.Repeat(" M=C3=BCnchen", 128)
		str_out := strings.Repeat(" München", 128)

		val := DecodeQuotedPrintable(str_in)
		assert.Equal(t, str_out, val)
	})
}
