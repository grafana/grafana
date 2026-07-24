package notifications

import (
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Regression for grafana/grafana#124000: a panic inside the writer passed by
// mail.v2 to the SetCopyFunc closure used to crash the calling alert
// notification goroutine, taking the whole Grafana process down. The closure
// must convert the panic into an error so the caller can fail gracefully.

type panickingWriter struct{}

func (panickingWriter) Write([]byte) (int, error) {
	var w io.Writer
	// reproduce the mail.v2 base64LineWriter shape: call Write on a nil
	// embedded io.Writer.
	return w.Write(nil)
}

type stubWriter struct {
	written []byte
}

func (s *stubWriter) Write(p []byte) (int, error) {
	s.written = append(s.written, p...)
	return len(p), nil
}

type errWriter struct{}

var errBoom = errors.New("boom")

func (errWriter) Write([]byte) (int, error) { return 0, errBoom }

// panicWriter panics with a caller-supplied value, to cover how the recovered
// value is turned back into an error.
type panicWriter struct {
	value any
}

func (p panicWriter) Write([]byte) (int, error) { panic(p.value) }

func TestCopyContentFunc_RecoversFromWriterPanic(t *testing.T) {
	fn := copyContentFunc("screenshot.png", []byte("payload"))

	require.NotPanics(t, func() {
		err := fn(panickingWriter{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "panic while writing email attachment")
		require.Contains(t, err.Error(), "screenshot.png")
	})
}

func TestCopyContentFunc_HappyPath(t *testing.T) {
	w := &stubWriter{}
	fn := copyContentFunc("ok.png", []byte("payload"))

	require.NoError(t, fn(w))
	require.Equal(t, "payload", string(w.written))
}

func TestCopyContentFunc_PropagatesWriteError(t *testing.T) {
	fn := copyContentFunc("err.png", []byte("payload"))

	err := fn(errWriter{})
	require.ErrorIs(t, err, errBoom)
	require.False(t, strings.Contains(err.Error(), "panic"),
		"plain write errors must not be reported as panics")
}

// A panic carrying an error value must keep that value in the chain, so callers
// can still match on it with errors.Is/As.
func TestCopyContentFunc_PanicWithErrorValueIsWrapped(t *testing.T) {
	fn := copyContentFunc("wrapped.png", []byte("payload"))

	err := fn(panicWriter{value: errBoom})
	require.ErrorIs(t, err, errBoom)
	require.Contains(t, err.Error(), "wrapped.png")
}

func TestCopyContentFunc_PanicWithStringValue(t *testing.T) {
	fn := copyContentFunc("str.png", []byte("payload"))

	err := fn(panicWriter{value: "kaboom"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "kaboom")
	require.Contains(t, err.Error(), "str.png")
}
