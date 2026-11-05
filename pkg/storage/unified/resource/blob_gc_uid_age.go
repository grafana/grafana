package resource

import (
	"context"
	"encoding/binary"
	"strings"
	"time"
	"uuid"
)

// blobUIDAges derives a blob's age from its UUIDv7 UID, so stores with no
// upload-time metadata (the plain kv.KV, including a remote one) need neither a
// bookkeeping section nor additional KV RPCs. UIDs are minted per upload, so a
// blob key is never overwritten and its embedded time is stable.
//
// Blobs with other UID versions (minted before UUIDv7 was used) have no
// recoverable age. They report a zero time, which the collector treats as
// "never collect", rather than guessing an age from process-local state that
// a restart would reset.
type blobUIDAges struct{}

func (blobUIDAges) FirstUnused(_ context.Context, key string, _ time.Time) (time.Time, error) {
	if created, ok := uuidV7Time(key[strings.LastIndexByte(key, '/')+1:]); ok {
		return created, nil
	}
	return time.Time{}, nil
}

// uuidV7Time returns the millisecond timestamp of a canonical UUIDv7 string.
func uuidV7Time(uid string) (time.Time, bool) {
	if len(uid) != 36 {
		return time.Time{}, false
	}
	raw, err := uuid.Parse(uid)
	if err != nil || raw[6]>>4 != 7 || raw[8]&0xc0 != 0x80 {
		return time.Time{}, false
	}
	ms := binary.BigEndian.Uint64(raw[:8]) >> 16
	return time.UnixMilli(int64(ms)), true
}
