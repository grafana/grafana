package store

import (
	"context"
	"errors"
	"fmt"
	"hash/crc32"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var ErrLockDB = errors.New("failed to acquire the database lock")

// WithLock acquires a database lock, executes the provided function, and releases the lock.
// Uses migrator.Lock which supports MySQL, and PostgreSQL, and for SQLite it does nothing.
// Does not wait for the lock to be acquired, if the lock is already acquired by another session it will return ErrLockDB.
func (st *DBstore) WithLock(ctx context.Context, lockName string, f func(ctx context.Context) error) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		cfg := migrator.LockCfg{
			Session: sess.Session,
			// The key must be a number in a string format, to be compatible with PostgreSQL,
			// so we generate a checksum of the lockName.
			Key: fmt.Sprint(crc32.ChecksumIEEE([]byte(lockName))),
		}
		err := st.SQLStore.GetDialect().Lock(cfg)
		// If Lock returns migrator.ErrLockDB, the lock is already acquired by another session.
		if err != nil && errors.Is(err, migrator.ErrLockDB) {
			return ErrLockDB
		}
		if err != nil {
			return fmt.Errorf("failed to acquire the database lock (%s): %w", cfg.Key, err)
		}

		defer func() {
			err := st.SQLStore.GetDialect().Unlock(cfg)
			if err != nil {
				st.Logger.Error("Failed to release the database lock", "err", err, "lock_name", cfg.Key)
			}
		}()

		return f(ctx)
	})
}
