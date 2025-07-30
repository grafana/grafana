package models

import (
	"encoding/binary"
	"fmt"
	"hash"
	"hash/fnv"
	"math"
	"unsafe"
)

// fingerprint is a wrapper for hash.Hash64 that adds utility methods to simplify hash calculation of structs
type fingerprint struct {
	h hash.Hash64
}

// creates a fingerprint that is backed by 64bit FNV-1a hash
func newFingerprint() fingerprint {
	return fingerprint{h: fnv.New64a()}
}

func (f fingerprint) String() string {
	return fmt.Sprintf("%016x", f.h.Sum64())
}

func (f fingerprint) writeBytes(b []byte) {
	_, _ = f.h.Write(b)
	// add a byte sequence that cannot happen in UTF-8 strings.
	_, _ = f.h.Write([]byte{255})
}

func (f fingerprint) writeString(s string) {
	if len(s) == 0 {
		f.writeBytes(nil)
		return
	}
	// #nosec G103 -- nosemgrep: use-of-unsafe-block
	// avoid allocation when converting string to byte slice
	f.writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
}

func (f fingerprint) writeFloat64(num float64) {
	bits := math.Float64bits(num)
	bytes := make([]byte, 8)
	binary.LittleEndian.PutUint64(bytes, bits)
	f.writeBytes(bytes)
}

func (f fingerprint) writeBool(b bool) {
	if b {
		f.writeBytes([]byte{1})
	} else {
		f.writeBytes([]byte{0})
	}
}
