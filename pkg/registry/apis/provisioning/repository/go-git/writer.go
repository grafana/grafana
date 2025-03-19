package gogit

import (
	"fmt"
	"io"
)

var ErrMaxBytesExceeded = fmt.Errorf("maximum bytes exceeded")

// maxBytesWriter wraps an io.Writer and counts the number of bytes written
type maxBytesWriter struct {
	writer   io.Writer
	written  int64
	maxSize  int64
	onExceed func()
	exceeded bool
}

func newMaxBytesWriter(w io.Writer, maxSize int64, onExceed func()) *maxBytesWriter {
	return &maxBytesWriter{
		writer:   w,
		maxSize:  maxSize,
		onExceed: onExceed,
	}
}

func (w *maxBytesWriter) Write(p []byte) (n int, err error) {
	if w.exceeded {
		return 0, ErrMaxBytesExceeded
	}

	n, err = w.writer.Write(p)
	w.written += int64(n)

	if w.maxSize > 0 && w.written > w.maxSize && !w.exceeded {
		w.exceeded = true
		if w.onExceed != nil {
			w.onExceed()
		}
		return n, ErrMaxBytesExceeded
	}

	return n, err
}
