package passkeyimpl

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/passkey"
)

var _ passkey.Store = (*sqlStore)(nil)

type sqlStore struct {
	db db.DB
}

func ProvideStore(db db.DB) passkey.Store {
	return &sqlStore{db: db}
}

// credentialIDHash is the single place the credential_id_hash column value is derived: the hex SHA-256
// of the raw credential id. Used for the unique index and for lookups in GetByCredentialID.
func credentialIDHash(credentialID []byte) string {
	sum := sha256.Sum256(credentialID)
	return hex.EncodeToString(sum[:])
}

func (s *sqlStore) Create(ctx context.Context, cred *passkey.Credential) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		cred.CredentialIDHash = credentialIDHash(cred.CredentialID)
		cred.Created = time.Now()
		if _, err := sess.Insert(cred); err != nil {
			return fmt.Errorf("failed to insert passkey credential: %w", err)
		}
		return nil
	})
}

func (s *sqlStore) GetByCredentialID(ctx context.Context, credentialID []byte) (*passkey.Credential, error) {
	var cred passkey.Credential
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Where("credential_id_hash = ?", credentialIDHash(credentialID)).Get(&cred)
		if err != nil {
			return err
		}
		if !has {
			return passkey.ErrCredentialNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &cred, nil
}

func (s *sqlStore) ListByUser(ctx context.Context, userID int64) ([]*passkey.Credential, error) {
	creds := make([]*passkey.Credential, 0)
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("user_id = ?", userID).Asc("id").Find(&creds)
	})
	if err != nil {
		return nil, err
	}
	return creds, nil
}

func (s *sqlStore) RecordUse(ctx context.Context, id, signCount int64) error {
	now := time.Now()
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table("user_passkey_credential").ID(id).
			Cols("sign_count", "last_used").
			Update(&passkey.Credential{SignCount: signCount, LastUsed: &now})
		return err
	})
}

func (s *sqlStore) Rename(ctx context.Context, id, userID int64, name string) error {
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table("user_passkey_credential").
			Where("id = ? AND user_id = ?", id, userID).
			Cols("name").
			Update(&passkey.Credential{Name: name})
		return err
	})
}

func (s *sqlStore) Delete(ctx context.Context, id, userID int64) error {
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM user_passkey_credential WHERE id = ? AND user_id = ?", id, userID)
		return err
	})
}
