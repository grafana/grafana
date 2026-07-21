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
}

var rootCapture = &captureRing{}

func (r *captureRing) Write(p []byte) (int, error) {
	written := len(p)

	r.mu.Lock()
	defer r.mu.Unlock()

	// A capture can stop after captureLogger's fast-path check but before this write acquires the
	// lock. Rechecking here prevents such an in-flight record from being retained while idle.
	if r.active.Load() == 0 {
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
	ring   *captureRing
	logger gokitlog.Logger
}

func newCaptureLogger() gokitlog.Logger {
	return &captureLogger{ring: rootCapture, logger: gokitlog.NewLogfmtLogger(rootCapture)}
}

func (l *captureLogger) Log(keyvals ...any) error {
	if l.ring.active.Load() == 0 {
		return nil
	}
	return l.logger.Log(keyvals...)
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
