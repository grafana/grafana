package passkeyimpl

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/passkey"
)

const (
	enrollKeyPrefix = "passkey-enroll:"
	enrollTTL       = 5 * time.Minute
)

// enrollmentSession is the state carried between an anonymous enroll begin and finish: the user the
// credential will belong to (resolved from a TempUser code or bootstrap token at begin), the flow it
// came from, and the opaque WebAuthn SessionData (serialized by the caller; opaque to this store).
type enrollmentSession struct {
	UserID          int64                `json:"userID"`
	Source          passkey.EnrollSource `json:"source"`
	WebAuthnSession []byte               `json:"webAuthnSession"`
}

// enrollmentStore holds the short-lived, single-use state for an anonymous passkey enrollment between
// its begin and finish steps, keyed by an opaque session id. It is backed by remotecache (via the
// cacheStorage interface from challenge_store.go) so begin and finish work across replicas in HA.
// Unlike the challenge store it also carries the enrolling user id, because anonymous finish has no
// session to derive it from.
type enrollmentStore struct {
	cache cacheStorage
	log   log.Logger
}

func newEnrollmentStore(cache cacheStorage) *enrollmentStore {
	return &enrollmentStore{cache: cache, log: log.New("passkey.enrollment")}
}

// set json-encodes the pending enrollment under sessionID with a fixed non-zero TTL (remotecache
// treats 0 as 24h).
func (s *enrollmentStore) set(ctx context.Context, sessionID string, sess enrollmentSession) error {
	data, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	return s.cache.Set(ctx, enrollKeyPrefix+sessionID, data, enrollTTL)
}

// take returns the pending enrollment for sessionID and deletes it, so each is used at most once. It
// returns remotecache.ErrCacheItemNotFound when the id is unknown, already used, or expired. The
// delete is best-effort: remotecache has no atomic get-and-delete, so a rare concurrent double-read is
// possible; the TTL bounds it.
func (s *enrollmentStore) take(ctx context.Context, sessionID string) (enrollmentSession, error) {
	key := enrollKeyPrefix + sessionID
	data, err := s.cache.Get(ctx, key)
	if err != nil {
		return enrollmentSession{}, err
	}
	if err := s.cache.Delete(ctx, key); err != nil {
		s.log.Warn("failed to delete used passkey enrollment session", "err", err)
	}
	var sess enrollmentSession
	if err := json.Unmarshal(data, &sess); err != nil {
		return enrollmentSession{}, err
	}
	return sess, nil
}
