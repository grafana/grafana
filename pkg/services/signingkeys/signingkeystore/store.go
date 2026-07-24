package signingkeystore

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type SigningStore interface {
	// List returns all non expired keys
	List(ctx context.Context) ([]signingkeys.SigningKey, error)
	// Add adds a signing key to the database. If the key already exists, it will be updated if force is true.
	// If force is false, the key will only be updated if it has expired. If the key does not exist, it will be added.
	// If expiresAt is nil, the key will not expire. Retrieve the result key with Get.
	Add(ctx context.Context, key *signingkeys.SigningKey, force bool) (*signingkeys.SigningKey, error)
	// Get returns the signing key with the specified key ID
	Get(ctx context.Context, keyID string) (*signingkeys.SigningKey, error)
}

var _ SigningStore = (*Store)(nil)

const cleanupRateLimitKey = "signingkeys-cleanup"

type Store struct {
	dbStore    db.DB
	log        log.Logger
	localCache *localcache.CacheService
}

func NewSigningKeyStore(dbStore db.DB) *Store {
	return &Store{
		dbStore:    dbStore,
		log:        log.New("signing.key_service"),
		localCache: localcache.New(12*time.Hour, 4*time.Hour),
	}
}

func (s *Store) List(ctx context.Context) ([]signingkeys.SigningKey, error) {
	var keys []signingkeys.SigningKey

	err := s.dbStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		return dbSession.SQL("SELECT * FROM signing_key WHERE expires_at IS NULL OR expires_at > ?", time.Now()).Find(&keys)
	})

	if err != nil {
		return nil, err
	}

	return keys, nil
}

// Add adds a private key to the service.
func (s *Store) Add(ctx context.Context, key *signingkeys.SigningKey, force bool) (*signingkeys.SigningKey, error) {
	var result *signingkeys.SigningKey

	err := s.dbStore.WithTransactionalDbSession(ctx, func(tx *sqlstore.DBSession) error {
		existingKey := &signingkeys.SigningKey{}
		exists, err := tx.SQL("SELECT * FROM signing_key WHERE key_id = ?", key.KeyID).Get(existingKey)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		if !exists {
			_, err = tx.Exec("INSERT INTO signing_key (key_id, private_key, added_at, alg, expires_at) VALUES (?, ?, ?, ?, ?)",
				key.KeyID, key.PrivateKey, key.AddedAt, key.Alg, key.ExpiresAt,
			)
			result = key
			return err
		}

		if force || (existingKey.ExpiresAt != nil && existingKey.ExpiresAt.Before(time.Now())) {
			_, err = tx.Exec("UPDATE signing_key SET private_key = ?, added_at = ?, alg = ?, expires_at = ? WHERE key_id = ?",
				key.PrivateKey, key.AddedAt, key.Alg, key.ExpiresAt, key.KeyID)

			result = key
			return err
		}

		result = existingKey
		return signingkeys.ErrSigningKeyAlreadyExists.Errorf("The specified key already exists: %s", existingKey.KeyID)
	})

	if _, ok := s.localCache.Get(cleanupRateLimitKey); !ok {
		go func() {
			defer func() {
				if err := recover(); err != nil {
					s.log.Error("panic during expired signing key cleanup", "err", err)
				}
			}()

			ctxGo, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			if err := s.cleanupExpiredKeys(ctxGo); err != nil {
				s.log.Error("Failed to cleanup expired signing keys", "err", err)
			}
		}()
		s.localCache.Set(cleanupRateLimitKey, true, 1*time.Hour)
	}

	return result, err
}

// Get implements SigningStore.
func (s *Store) Get(ctx context.Context, keyID string) (*signingkeys.SigningKey, error) {
	key := signingkeys.SigningKey{}
	err := s.dbStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		exists, err := dbSession.SQL("SELECT * FROM signing_key WHERE key_id = ?", keyID).Get(&key)
		if !exists {
			return signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
		}

		return err
	})

	if err != nil {
		return nil, err
	}

	// Bail out if key has expired
	if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
		return nil, signingkeys.ErrSigningKeyNotFound.Errorf("The specified key was not found: %s", keyID)
	}

	return &key, nil
}

// cleanupExpiredKeys removes expired keys from the database that have expired more than 61 days ago
func (s *Store) cleanupExpiredKeys(ctx context.Context) error {
	err := s.dbStore.WithTransactionalDbSession(ctx, func(tx *sqlstore.DBSession) error {
		_, err := tx.Exec("DELETE FROM signing_key WHERE expires_at IS NOT NULL AND expires_at < ?",
			time.Now().UTC().Add(-61*24*time.Hour))
		return err
	})

	return err
}
