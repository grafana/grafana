package passkeyimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	challengeKeyPrefix = "passkey-challenge:"
	challengeTTL       = 5 * time.Minute
)

// cacheStorage is the subset of remotecache the challenge store needs. Keeping it a local interface
// lets the store be unit-tested with an in-memory fake; Wire injects the concrete *remotecache.RemoteCache.
type cacheStorage interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, expire time.Duration) error
	Delete(ctx context.Context, key string) error
}

// challengeStore holds the short-lived, single-use WebAuthn challenge state between the begin and finish
// steps of a ceremony, keyed by an opaque session id. It is backed by remotecache so begin and finish
// work across replicas in an HA deployment. The stored value is opaque bytes; callers own serialization.
type challengeStore struct {
	cache cacheStorage
	log   log.Logger
}

func newChallengeStore(cache cacheStorage) *challengeStore {
	return &challengeStore{cache: cache, log: log.New("passkey.challenge")}
}

// set stores the challenge for sessionID with a fixed non-zero TTL (remotecache treats 0 as 24h).
func (s *challengeStore) set(ctx context.Context, sessionID string, data []byte) error {
	return s.cache.Set(ctx, challengeKeyPrefix+sessionID, data, challengeTTL)
}

// take returns the challenge for sessionID and deletes it, so each challenge is used at most once. It
// returns remotecache.ErrCacheItemNotFound when the id is unknown, already used, or expired. The delete
// is best-effort: remotecache has no atomic get-and-delete, so a rare concurrent double-read is possible;
// the TTL bounds it.
func (s *challengeStore) take(ctx context.Context, sessionID string) ([]byte, error) {
	key := challengeKeyPrefix + sessionID
	data, err := s.cache.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	if err := s.cache.Delete(ctx, key); err != nil {
		s.log.Warn("failed to delete used passkey challenge", "err", err)
	}
	return data, nil
}
