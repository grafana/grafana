package artifacts

import (
	"io"
	"os"
	"sync"
)

// SyncWriter wraps a writer and makes its writes synchronous, preventing multiple threads writing to the same writer
// from creating wacky looking output.
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
