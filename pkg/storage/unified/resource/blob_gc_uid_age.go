package resource

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"strings"
	"sync"
	"time"
)

// blobUIDAgeStore derives a blob's age from its UUIDv7 UID, so stores with no
// upload-time metadata (the plain kv.KV, including a remote one) need neither a
// bookkeeping section nor additional KV RPCs. UIDs are minted per upload, so a
// blob key is never overwritten and its embedded time is stable.
//
// Blobs with other UID versions (written before UUIDv7 was used) have no
// embedded time. Their first-unused time is tracked in memory only: a restart
// can only delay their collection, never accelerate it.
type blobUIDAgeStore struct {
	BlobGCStore

	mu     sync.Mutex
	legacy map[string]time.Time
}

func newBlobUIDAgeStore(store BlobGCStore) *blobUIDAgeStore {
	return &blobUIDAgeStore{BlobGCStore: store, legacy: map[string]time.Time{}}
}

func (s *blobUIDAgeStore) FirstUnused(_ context.Context, key string, now time.Time) (time.Time, error) {
	if created, ok := uuidV7Time(key[strings.LastIndexByte(key, '/')+1:]); ok {
		return created, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	first, ok := s.legacy[key]
	if !ok {
		first = now
		s.legacy[key] = first
	}
	return first, nil
}

func (s *blobUIDAgeStore) ClearUnused(_ context.Context, key string) error {
	s.mu.Lock()
	delete(s.legacy, key)
	s.mu.Unlock()
	return nil
}

// uuidV7Time returns the millisecond timestamp of a canonical UUIDv7 string.
func uuidV7Time(uid string) (time.Time, bool) {
	if len(uid) != 36 || uid[8] != '-' || uid[13] != '-' || uid[14] != '7' {
		return time.Time{}, false
	}
	raw, err := hex.DecodeString(uid[:8] + uid[9:13])
	if err != nil {
		return time.Time{}, false
	}
	ms := binary.BigEndian.Uint64(append([]byte{0, 0}, raw...))
	return time.UnixMilli(int64(ms)), true
}
