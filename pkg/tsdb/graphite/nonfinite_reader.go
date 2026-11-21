package graphite

import (
	"bytes"
	"io"
)

const nonFiniteBufferSize = 32 << 10

// nonFiniteReader rewrites bare +Inf and -Inf (Metrictank values) and Infinity and -Infinity
// (graphite-web 1.1.0 to 1.1.7 tags) outside JSON strings to ±1e999, which decode as ±Inf.
type nonFiniteReader struct {
	r        io.Reader
	buf      []byte
	raw      []byte // source bytes not yet returned, a window of buf
	repl     string
	err      error
	inString bool
	escaped  bool
	prev     byte // last non-whitespace byte returned
}

func newNonFiniteReader(r io.Reader) *nonFiniteReader {
	return &nonFiniteReader{r: r, buf: make([]byte, nonFiniteBufferSize)}
}

func (f *nonFiniteReader) Read(p []byte) (int, error) {
	n := 0
	for n < len(p) {
		if f.repl != "" {
			c := copy(p[n:], f.repl)
			f.repl = f.repl[c:]
			n += c
			continue
		}
		if len(f.raw) == 0 {
			if n > 0 || f.err != nil {
				break
			}
			f.fill()
			continue
		}

		window := min(len(f.raw), len(p)-n)
		safe := f.scan(f.raw[:window])
		if safe == window && f.holdSign(window) {
			safe--
		}
		copy(p[n:], f.raw[:safe])
		f.advance(safe)
		n += safe
		if safe == window {
			continue
		}

		repl, size, more := f.match()
		switch {
		case more:
			if n > 0 {
				return n, nil
			}
			f.fill()
		case size > 0:
			f.repl = repl
			f.raw = f.raw[size:]
			f.prev = repl[len(repl)-1]
		default:
			p[n] = f.raw[0]
			f.advance(1)
			n++
		}
	}
	if n == 0 {
		return 0, f.err
	}
	return n, nil
}

func (f *nonFiniteReader) fill() {
	kept := copy(f.buf, f.raw)
	n, err := f.r.Read(f.buf[kept:])
	f.raw = f.buf[:kept+n]
	if err != nil {
		f.err = err
	}
}

func (f *nonFiniteReader) advance(n int) {
	for i := n - 1; i >= 0; i-- {
		if c := f.raw[i]; !isJSONSpace(c) {
			f.prev = c
			break
		}
	}
	f.raw = f.raw[n:]
}

// scan returns the length of the prefix of b before the next byte that can
// start a non-finite value, and tracks the string state over that prefix.
func (f *nonFiniteReader) scan(b []byte) int {
	nextI := -1
	for i := 0; i < len(b); {
		if f.inString {
			i = f.skipString(b, i)
			continue
		}
		if nextI < i {
			nextI = bytes.IndexByte(b[i:], 'I')
			if nextI < 0 {
				nextI = len(b)
			} else {
				nextI += i
			}
		}
		q := bytes.IndexByte(b[i:nextI], '"')
		if q < 0 {
			if nextI < len(b) && nextI > i && isSign(b[nextI-1]) {
				return nextI - 1
			}
			return nextI
		}
		i += q + 1
		f.inString = true
	}
	return len(b)
}

func (f *nonFiniteReader) skipString(b []byte, i int) int {
	for ; i < len(b); i++ {
		switch {
		case f.escaped:
			f.escaped = false
		case b[i] == '\\':
			f.escaped = true
		case b[i] == '"':
			f.inString = false
			return i + 1
		}
	}
	return i
}

// holdSign reports whether a sign that ends the window has to wait for the
// next byte, which tells whether it starts -Inf or -Infinity.
func (f *nonFiniteReader) holdSign(window int) bool {
	if f.inString || !isSign(f.raw[window-1]) {
		return false
	}
	if window < len(f.raw) {
		return f.raw[window] == 'I'
	}
	return f.err == nil
}

// match returns the replacement for the value at the start of f.raw and the
// number of source bytes it replaces, or more when f.raw is too short to tell.
func (f *nonFiniteReader) match() (repl string, size int, more bool) {
	b := f.raw
	var sign byte
	if isSign(b[0]) {
		sign, b = b[0], b[1:]
	}
	if len(b) == 0 {
		return "", 0, f.err == nil
	}
	if b[0] != 'I' || !isValueStart(f.prev) {
		return "", 0, false
	}
	for _, word := range [...]string{"Infinity", "Inf"} {
		if (word == "Infinity" && sign == '+') || (word == "Inf" && sign == 0) {
			continue
		}
		ok, more := f.hasWord(b, word)
		if more {
			return "", 0, true
		}
		if ok {
			size = len(word)
			if sign != 0 {
				size++
			}
			if sign == '-' {
				return "-1e999", size, false
			}
			return "1e999", size, false
		}
	}
	return "", 0, false
}

// hasWord reports whether b starts with word followed by a delimiter or the
// end of the input, or more when b ends before that is known.
func (f *nonFiniteReader) hasWord(b []byte, word string) (ok, more bool) {
	n := min(len(b), len(word))
	if string(b[:n]) != word[:n] {
		return false, false
	}
	if len(b) > len(word) {
		return isDelimiter(b[len(word)]), false
	}
	if f.err == nil {
		return false, true
	}
	return len(b) == len(word), false
}

func isSign(c byte) bool { return c == '+' || c == '-' }

func isJSONSpace(c byte) bool { return c == ' ' || c == '\t' || c == '\n' || c == '\r' }

func isDelimiter(c byte) bool { return c == ',' || c == ']' || c == '}' || isJSONSpace(c) }

func isValueStart(c byte) bool { return c == '[' || c == ',' || c == ':' }
