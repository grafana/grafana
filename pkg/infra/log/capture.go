package log

import (
	"bytes"
	"sync"
	"sync/atomic"

	gokitlog "github.com/go-kit/log"
)

const (
	captureRingMaxEntries = 5000
	captureRingMaxBytes   = 8 * 1024 * 1024
	captureLineMaxBytes   = 8 * 1024
	captureTruncatedMark  = " [truncated]"
)

type capturedLine struct {
	seq  uint64
	line string
}

type captureRing struct {
	mu         sync.Mutex
	entries    []capturedLine
	totalBytes int
	nextSeq    uint64
	active     atomic.Int64
	// generation increments each time capturing resumes from idle. A record carries the generation
	// observed when it was admitted so a superseded window's in-flight write cannot land in a later
	// one. See write.
	generation atomic.Uint64
}

var rootCapture = &captureRing{}

// Write is the io.Writer entry point; it admits the record under the ring's current generation.
func (r *captureRing) Write(p []byte) (int, error) {
	return r.write(r.generation.Load(), p)
}

// write appends a record admitted under generation gen. captureLogger snapshots the generation
// before formatting, so a record whose fast-path check passed during one capture but that only
// reaches the lock after that capture stopped and a new one started is dropped rather than being
// assigned a fresh sequence in the later capture's window.
func (r *captureRing) write(gen uint64, p []byte) (int, error) {
	written := len(p)

	r.mu.Lock()
	defer r.mu.Unlock()

	if r.active.Load() == 0 || r.generation.Load() != gen {
		return written, nil
	}

	line := bytes.TrimRight(p, "\n")
	if len(line) > captureLineMaxBytes {
		// Query-log filtering happens after capture. A trace or datasource UID field beyond this
		// cutoff cannot match query.log, but the bounded, visibly truncated line remains available in
		// server-window.log.
		line = append(line[:captureLineMaxBytes-len(captureTruncatedMark):captureLineMaxBytes-len(captureTruncatedMark)], captureTruncatedMark...)
	}

	entry := capturedLine{seq: r.nextSeq, line: string(line)}
	r.nextSeq++
	r.entries = append(r.entries, entry)
	r.totalBytes += len(entry.line)

	for len(r.entries) > captureRingMaxEntries || r.totalBytes > captureRingMaxBytes {
		r.totalBytes -= len(r.entries[0].line)
		r.entries[0] = capturedLine{}
		r.entries = r.entries[1:]
	}

	return written, nil
}

func (r *captureRing) start() uint64 {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.active.Load() == 0 {
		r.generation.Add(1)
	}
	r.active.Add(1)
	return r.nextSeq
}

func (r *captureRing) stop(startSeq uint64) []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	lines := make([]string, 0, len(r.entries))
	for _, entry := range r.entries {
		if entry.seq >= startSeq {
			lines = append(lines, entry.line)
		}
	}

	if r.active.Add(-1) == 0 {
		r.clearLocked()
	}

	return lines
}

func (r *captureRing) clearLocked() {
	clear(r.entries)
	r.entries = nil
	r.totalBytes = 0
}

type captureLogger struct {
	ring *captureRing
}

func newCaptureLogger() gokitlog.Logger {
	return &captureLogger{ring: rootCapture}
}

func (l *captureLogger) Log(keyvals ...any) error {
	if l.ring.active.Load() == 0 {
		return nil
	}
	// Snapshot the generation before formatting so the record is admitted only if the capture that
	// was live when we decided to emit is still the current one when the write reaches the ring.
	gen := l.ring.generation.Load()
	return gokitlog.NewLogfmtLogger(&generationWriter{ring: l.ring, generation: gen}).Log(keyvals...)
}

// generationWriter tags each formatted record with the capture generation observed at admission
// time so captureRing.write can reject records left over from a superseded window.
type generationWriter struct {
	ring       *captureRing
	generation uint64
}

func (w *generationWriter) Write(p []byte) (int, error) {
	return w.ring.write(w.generation, p)
}

// Capture is one sequence-bounded view of the shared in-memory log sink.
type Capture struct {
	startSeq uint64
	stopped  atomic.Bool
}

// StartCapture activates the in-memory log sink and starts a new capture window.
func StartCapture() *Capture {
	return &Capture{startSeq: rootCapture.start()}
}

// Stop closes the capture window and returns the lines emitted since StartCapture. It is safe to
// call more than once; subsequent calls return nil.
func (c *Capture) Stop() []string {
	if c == nil || !c.stopped.CompareAndSwap(false, true) {
		return nil
	}
	return rootCapture.stop(c.startSeq)
}
