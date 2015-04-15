package engineio

import (
	"github.com/googollee/go-engine.io/parser"
	"io"
	"sync"
)

type connReader struct {
	*parser.PacketDecoder
	closeChan chan struct{}
}

func newConnReader(d *parser.PacketDecoder, closeChan chan struct{}) *connReader {
	return &connReader{
		PacketDecoder: d,
		closeChan:     closeChan,
	}
}

func (r *connReader) Close() error {
	if r.closeChan == nil {
		return nil
	}
	r.closeChan <- struct{}{}
	r.closeChan = nil
	return nil
}

type connWriter struct {
	io.WriteCloser
	locker *sync.Mutex
}

func newConnWriter(w io.WriteCloser, locker *sync.Mutex) *connWriter {
	return &connWriter{
		WriteCloser: w,
		locker:      locker,
	}
}

func (w *connWriter) Close() error {
	defer func() {
		if w.locker != nil {
			w.locker.Unlock()
			w.locker = nil
		}
	}()
	return w.WriteCloser.Close()
}
