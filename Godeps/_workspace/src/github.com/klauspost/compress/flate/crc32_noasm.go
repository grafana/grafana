//+build !amd64 noasm appengine

// Copyright 2015, Klaus Post, see LICENSE for details.

package flate

func init() {
	useSSE42 = false
}

// crc32sse should never be called.
func crc32sse(a []byte) hash {
	panic("no assembler")
}

// crc32sseAll should never be called.
func crc32sseAll(a []byte, dst []hash) {
	panic("no assembler")
}

// matchLenSSE4 should never be called.
func matchLenSSE4(a, b []byte, max int) int {
	panic("no assembler")
	return 0
}

// histogram accumulates a histogram of b in h.
// h must be at least 256 entries in length,
// and must be cleared before calling this function.
func histogram(b []byte, h []int32) {
	for _, t := range b {
		h[t]++
	}
}
