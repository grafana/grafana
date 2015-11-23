package socketio

import (
	"io"
)

type writerHelper struct {
	writer io.Writer
	err    error
}

func newWriterHelper(w io.Writer) *writerHelper {
	return &writerHelper{
		writer: w,
	}
}

func (h *writerHelper) Write(p []byte) {
	if h.err != nil {
		return
	}
	for len(p) > 0 {
		n, err := h.writer.Write(p)
		if err != nil {
			h.err = err
			return
		}
		p = p[n:]
	}
}

func (h *writerHelper) Error() error {
	return h.err
}
