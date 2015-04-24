package socketio

import (
	"bytes"
	"io"
)

type trimWriter struct {
	trimChars string
	trimBuf   []byte
	output    io.Writer
}

func newTrimWriter(w io.Writer, trimChars string) *trimWriter {
	return &trimWriter{
		trimChars: trimChars,
		output:    w,
	}
}

func (w *trimWriter) Write(p []byte) (int, error) {
	out := bytes.TrimRight(p, w.trimChars)
	buf := p[len(out):]
	var written int
	if (len(out) > 0) && (w.trimBuf != nil) {
		var err error
		if written, err = w.output.Write(w.trimBuf); err != nil {
			return 0, err
		}
		w.trimBuf = nil
	}
	if w.trimBuf != nil {
		w.trimBuf = append(w.trimBuf, buf...)
	} else {
		w.trimBuf = buf
	}
	if len(p) == 0 {
		return written, nil
	}
	ret, err := w.output.Write(out)
	if err != nil {
		return 0, err
	}
	return written + ret, nil
}
