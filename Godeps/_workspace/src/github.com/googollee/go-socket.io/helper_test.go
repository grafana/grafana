package socketio

import (
	"bytes"
	"io"
	"io/ioutil"

	"github.com/googollee/go-engine.io"
)

type WriterNopCloser struct {
	io.Writer
}

func NewWriterNopCloser(w io.Writer) io.WriteCloser {
	return WriterNopCloser{
		Writer: w,
	}
}

func (w WriterNopCloser) Close() error {
	return nil
}

type FrameData struct {
	Buffer *bytes.Buffer
	Type   engineio.MessageType
}

type FrameSaver struct {
	data []FrameData
}

func (f *FrameSaver) NextWriter(t engineio.MessageType) (io.WriteCloser, error) {
	data := FrameData{
		Buffer: bytes.NewBuffer(nil),
		Type:   t,
	}
	f.data = append(f.data, data)
	return NewWriterNopCloser(data.Buffer), nil
}

func (f *FrameSaver) NextReader() (engineio.MessageType, io.ReadCloser, error) {
	if len(f.data) == 0 {
		return engineio.MessageText, nil, io.EOF
	}
	ret := f.data[0]
	f.data = f.data[1:]
	return ret.Type, ioutil.NopCloser(ret.Buffer), nil
}
