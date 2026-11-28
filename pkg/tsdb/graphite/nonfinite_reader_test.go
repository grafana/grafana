package graphite

import (
	"io"
	"strings"
	"testing"
	"testing/iotest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNonFiniteReader(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "signed Inf values", in: `[+Inf,-Inf]`, want: `[1e999,-1e999]`},
		{name: "Infinity values", in: `[Infinity,-Infinity]`, want: `[1e999,-1e999]`},
		{name: "object member values", in: `{"a":+Inf,"b": -Infinity}`, want: `{"a":1e999,"b": -1e999}`},
		{name: "whitespace around values", in: "[ +Inf ,\n\tInfinity\r\n]", want: "[ 1e999 ,\n\t1e999\r\n]"},
		{name: "top-level value", in: `-Infinity`, want: `-Infinity`},
		{name: "strings are kept", in: `["+Inf","-Infinity","Infinity"]`, want: `["+Inf","-Infinity","Infinity"]`},
		{name: "escaped quotes stay inside the string", in: `["a\"Infinity",Infinity]`, want: `["a\"Infinity",1e999]`},
		{name: "escaped backslash ends the string", in: `["a\\",Infinity,"\\\"Inf"]`, want: `["a\\",1e999,"\\\"Inf"]`},
		{name: "not after a value start", in: `[1Infinity,"a"Infinity,-1-Inf]`, want: `[1Infinity,"a"Infinity,-1-Inf]`},
		{name: "not before a delimiter", in: `[Infinityx,-Inf1,+Inf+]`, want: `[Infinityx,-Inf1,+Inf+]`},
		{name: "unsupported forms", in: `[Inf,+Infinity,NaN,-NaN,inf,INF]`, want: `[Inf,+Infinity,NaN,-NaN,inf,INF]`},
		{name: "truncated forms", in: `[-Infini`, want: `[-Infini`},
		{name: "truncated sign", in: `[-`, want: `[-`},
		{name: "numbers with signs", in: `[-1,-0.5,1e+5,1E-5,-1e+9999]`, want: `[-1,-0.5,1e+5,1E-5,-1e+9999]`},
		{name: "empty input", in: ``, want: ``},
		{name: "invalid UTF-8 and control bytes", in: "[\"\xff\",\x00Infinity]", want: "[\"\xff\",\x00Infinity]"},
	}
	readers := []struct {
		name string
		wrap func(io.Reader) io.Reader
	}{
		{"whole", func(r io.Reader) io.Reader { return r }},
		{"one byte source", iotest.OneByteReader},
		{"half source", iotest.HalfReader},
		{"data with EOF", iotest.DataErrReader},
	}
	for _, tt := range tests {
		for _, rd := range readers {
			t.Run(tt.name+"/"+rd.name, func(t *testing.T) {
				got, err := io.ReadAll(newNonFiniteReader(rd.wrap(strings.NewReader(tt.in))))
				require.NoError(t, err)
				assert.Equal(t, tt.want, string(got))

				got, err = io.ReadAll(iotest.OneByteReader(newNonFiniteReader(rd.wrap(strings.NewReader(tt.in)))))
				require.NoError(t, err)
				assert.Equal(t, tt.want, string(got), "one-byte reads from the pre-lexer")

				require.NoError(t, iotest.TestReader(newNonFiniteReader(rd.wrap(strings.NewReader(tt.in))), []byte(tt.want)))
			})
		}
	}
}

func TestNonFiniteReaderLongInput(t *testing.T) {
	in := `[` + strings.Repeat(`["s\"Infinity\\",+Inf,-Infinity,1.5],`, 20000) + `null]`
	want := `[` + strings.Repeat(`["s\"Infinity\\",1e999,-1e999,1.5],`, 20000) + `null]`
	got, err := io.ReadAll(newNonFiniteReader(iotest.HalfReader(strings.NewReader(in))))
	require.NoError(t, err)
	assert.Equal(t, want, string(got))
}

func TestNonFiniteReaderReturnsSourceError(t *testing.T) {
	_, err := io.ReadAll(newNonFiniteReader(iotest.TimeoutReader(strings.NewReader(`[+Inf,1]`))))
	require.ErrorIs(t, err, iotest.ErrTimeout)
}
