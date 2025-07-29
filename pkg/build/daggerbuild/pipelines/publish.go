package pipelines

import (
	"io"
	"os"
	"sync"
)

type SyncWriter struct {
	Writer io.Writer

	mutex *sync.Mutex
}

func NewSyncWriter(w io.Writer) *SyncWriter {
	return &SyncWriter{
		Writer: w,
		mutex:  &sync.Mutex{},
	}
}

func (w *SyncWriter) Write(b []byte) (int, error) {
	w.mutex.Lock()
	defer w.mutex.Unlock()

	return w.Writer.Write(b)
}

var Stdout = NewSyncWriter(os.Stdout)
