package resource

import (
	"errors"
	"io"
)

// ErrWriteLimitExceeded is returned when a LimitedWriter receives more data than allowed.
var ErrWriteLimitExceeded = errors.New("write limit exceeded")

// LimitedWriter wraps a writer and stops accepting data once the limit is reached,
// mirroring io.LimitedReader semantics.
type LimitedWriter struct {
	W io.Writer
	N int64
}

func (lw *LimitedWriter) Write(p []byte) (int, error) {
	if int64(len(p)) > lw.N {
		return 0, ErrWriteLimitExceeded
	}
	n, err := lw.W.Write(p)
	lw.N -= int64(n)
	return n, err
}
