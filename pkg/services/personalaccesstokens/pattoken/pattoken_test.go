package pattoken

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewAndParse(t *testing.T) {
	tok, err := New()
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(tok.Secret, Prefix))
	require.True(t, HasPrefix(tok.Secret))
	require.Equal(t, tok.Secret[len(tok.Secret)-HintLength:], tok.Hint)

	hash, err := Parse(tok.Secret)
	require.NoError(t, err)
	require.Equal(t, tok.Hash, hash)
	require.Len(t, hash, 64)
	require.NotContains(t, hash, tok.Secret)
	require.True(t, EqualHash(hash, tok.Hash))
}

func TestNewIsUnique(t *testing.T) {
	a, err := New()
	require.NoError(t, err)
	b, err := New()
	require.NoError(t, err)
	require.NotEqual(t, a.Secret, b.Secret)
	require.NotEqual(t, a.Hash, b.Hash)
}

func TestParseRejectsInvalid(t *testing.T) {
	tok, err := New()
	require.NoError(t, err)

	tampered := []byte(tok.Secret)
	if tampered[len(Prefix)] == 'A' {
		tampered[len(Prefix)] = 'B'
	} else {
		tampered[len(Prefix)] = 'A'
	}

	cases := map[string]string{
		"empty":          "",
		"wrong prefix":   "glsa_" + tok.Secret[len(Prefix):],
		"no checksum":    tok.Secret[:len(tok.Secret)-9],
		"truncated":      tok.Secret[:len(tok.Secret)-1],
		"extra":          tok.Secret + "0",
		"tampered":       string(tampered),
		"bad charset":    Prefix + strings.Repeat("-", secretLength) + tok.Secret[len(Prefix)+secretLength:],
		"prefix only":    Prefix,
		"whitespace pad": " " + tok.Secret,
	}
	for name, in := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := Parse(in)
			require.ErrorIs(t, err, ErrInvalidToken)
		})
	}
}

func TestRedact(t *testing.T) {
	tok, err := New()
	require.NoError(t, err)

	out := Redact("Authorization: Bearer " + tok.Secret + " failed; other glpat_abc")
	require.NotContains(t, out, tok.Secret)
	require.NotContains(t, out, "abc")
	require.Contains(t, out, "Bearer glpat_[REDACTED] failed")
	require.Equal(t, "nothing to see", Redact("nothing to see"))
}

func FuzzParse(f *testing.F) {
	tok, _ := New()
	f.Add(tok.Secret)
	f.Add("glpat_")
	f.Fuzz(func(t *testing.T, s string) {
		hash, err := Parse(s)
		if err == nil {
			require.Len(t, hash, 64)
		}
	})
}
